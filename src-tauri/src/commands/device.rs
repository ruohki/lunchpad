//! Device / MIDI commands. Blocking MIDI work runs on the blocking pool so
//! the async runtime is never stalled.

use super::{err, AppState, CmdResult};
use crate::midi::models::driver_for;
use crate::midi::scan;
use crate::midi::*;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelInfo {
    pub model: LaunchpadModel,
    pub name: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectRequest {
    pub input_name: String,
    pub output_name: String,
    pub model: LaunchpadModel,
    #[serde(default)]
    pub firmware: Option<String>,
    /// Chosen by hand: the model is trusted without a device inquiry, now and on reconnect.
    #[serde(default)]
    pub manual: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MidiPorts {
    pub inputs: Vec<MidiPortInfo>,
    pub outputs: Vec<MidiPortInfo>,
}

/// Every MIDI port by name, for connecting by hand to a device the scan did not identify.
#[tauri::command]
pub async fn list_midi_ports() -> CmdResult<MidiPorts> {
    tauri::async_runtime::spawn_blocking(|| {
        Ok(MidiPorts { inputs: scan::list_inputs().map_err(err)?, outputs: scan::list_outputs().map_err(err)? })
    })
    .await
    .map_err(err)?
}

/// Discover Launchpads via Universal Device Inquiry.
#[tauri::command]
pub async fn scan_launchpads(state: State<'_, AppState>) -> CmdResult<Vec<DiscoveredLaunchpad>> {
    let manager = state.manager.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let (exclude, connected) = {
            let m = manager.lock();
            (m.connected_port_names(), m.state().device)
        };
        DeviceManager::scan(&exclude, connected.as_ref()).map_err(err)
    })
    .await
    .map_err(err)?
}

#[tauri::command]
pub async fn connect_launchpad(request: ConnectRequest, state: State<'_, AppState>) -> CmdResult<DeviceState> {
    let manager = state.manager.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut m = manager.lock();
        m.connect(&request.input_name, &request.output_name, request.model, request.firmware, request.manual).map_err(err)?;
        Ok(m.state())
    })
    .await
    .map_err(err)?
}

/// Start a Launchpad-less session with a model's layout.
#[tauri::command]
pub async fn connect_virtual(model: LaunchpadModel, state: State<'_, AppState>) -> CmdResult<DeviceState> {
    let manager = state.manager.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut m = manager.lock();
        m.connect_virtual(model).map_err(err)?;
        Ok(m.state())
    })
    .await
    .map_err(err)?
}

#[tauri::command]
pub async fn disconnect_launchpad(state: State<'_, AppState>) -> CmdResult<DeviceState> {
    let manager = state.manager.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut m = manager.lock();
        m.disconnect();
        Ok(m.state())
    })
    .await
    .map_err(err)?
}

#[tauri::command]
pub async fn get_device_state(state: State<'_, AppState>) -> CmdResult<DeviceState> {
    Ok(state.manager.lock().state())
}

#[tauri::command]
pub async fn set_auto_connect(enabled: bool, state: State<'_, AppState>) -> CmdResult<DeviceState> {
    let mut m = state.manager.lock();
    m.set_auto_connect(enabled).map_err(err)?;
    Ok(m.state())
}

#[tauri::command]
pub async fn set_press_feedback(enabled: bool, state: State<'_, AppState>) -> CmdResult<DeviceState> {
    let mut m = state.manager.lock();
    m.set_press_feedback(enabled).map_err(err)?;
    Ok(m.state())
}

/// Velocity that counts as a press on velocity-sensitive pads (`null` = model default).
#[tauri::command]
pub async fn set_press_threshold(threshold: Option<u8>, state: State<'_, AppState>) -> CmdResult<DeviceState> {
    let mut m = state.manager.lock();
    m.set_press_threshold(threshold.map(|t| t.clamp(1, 127))).map_err(err)?;
    Ok(m.state())
}

#[tauri::command]
pub async fn forget_device(state: State<'_, AppState>) -> CmdResult<DeviceState> {
    let manager = state.manager.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut m = manager.lock();
        m.forget_device().map_err(err)?;
        Ok(m.state())
    })
    .await
    .map_err(err)?
}

/// Layout description for any model (also used to preview without hardware).
#[tauri::command]
pub async fn get_layout(model: LaunchpadModel) -> CmdResult<Layout> {
    Ok(driver_for(model).layout())
}

#[tauri::command]
pub async fn list_models() -> CmdResult<Vec<ModelInfo>> {
    Ok(LaunchpadModel::ALL
        .iter()
        .map(|m| ModelInfo { model: *m, name: m.display_name().to_string() })
        .collect())
}

/// A click on a pad in the UI behaves like a press on the hardware.
#[tauri::command]
pub async fn press_pad(x: u8, y: u8, pressed: bool, state: State<'_, AppState>) -> CmdResult<()> {
    state.manager.lock().simulate_press(x, y, pressed).map_err(err)
}

/// A drag on a knob or touch strip in the UI behaves like a turn of the hardware control.
#[tauri::command]
pub async fn control_pad(x: u8, y: u8, value: f32, kind: Option<crate::midi::types::ControlKind>, released: Option<bool>, state: State<'_, AppState>) -> CmdResult<()> {
    state.manager.lock().simulate_control(x, y, value, kind.unwrap_or_default(), released.unwrap_or(false)).map_err(err)
}

/// Turn every LED off, then repaint the active page.
#[tauri::command]
pub async fn reset_leds(state: State<'_, AppState>) -> CmdResult<()> {
    state.manager.lock().reset_leds().map_err(err)
}

#[tauri::command]
pub async fn send_raw_midi(bytes: Vec<u8>, state: State<'_, AppState>) -> CmdResult<()> {
    let output = state.manager.lock().output().ok_or(MidiError::NotConnected).map_err(err)?;
    output.send_raw(bytes).map_err(err)
}
