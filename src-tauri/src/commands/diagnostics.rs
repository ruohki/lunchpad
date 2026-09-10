//! One-shot diagnosis for bug reports: versions, operating system, MIDI ports,
//! the Launchpad, audio devices, integrations and profile size.

use super::{AppState, CmdResult};
use crate::midi::scan::{list_inputs, list_outputs};
use serde::Serialize;
use tauri::{AppHandle, Manager, State};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Diagnostics {
    pub app_version: String,
    pub tauri_version: String,
    pub webview_version: Option<String>,
    pub os: OsSummary,
    pub config_dir: String,
    pub log_dir: String,
    pub device: DeviceSummary,
    pub midi_inputs: Vec<String>,
    pub midi_outputs: Vec<String>,
    pub midi_error: Option<String>,
    pub audio: AudioSummary,
    pub integrations: Vec<IntegrationSummary>,
    pub profile: ProfileSummary,
    pub settings: SettingsSummary,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OsSummary {
    pub name: String,
    pub version: String,
    pub arch: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceSummary {
    pub status: String,
    pub model: Option<String>,
    pub input: Option<String>,
    pub output: Option<String>,
    pub firmware: Option<String>,
    pub is_virtual: bool,
    pub error: Option<String>,
    pub auto_connect: bool,
    pub remembered: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioSummary {
    pub default_device: Option<String>,
    pub devices: Vec<String>,
    pub configured: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IntegrationSummary {
    pub name: String,
    pub enabled: bool,
    pub endpoint: String,
    pub connected: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileSummary {
    pub pages: usize,
    pub buttons: usize,
    pub actions: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsSummary {
    pub developer_mode: bool,
    pub push_to_talk: Option<String>,
    pub stay_on_top: bool,
    pub minimize_to_tray: bool,
    pub run_at_startup: bool,
}

/// Reveal the log folder in the file manager.
#[tauri::command]
pub async fn open_log_dir(app: AppHandle) -> CmdResult<()> {
    use tauri_plugin_opener::OpenerExt;
    let dir = app.try_state::<crate::LogState>().and_then(|l| l.dir.clone()).ok_or("no log folder on this platform")?;
    app.opener().open_path(dir.display().to_string(), None::<&str>).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn diagnostics(app: AppHandle, state: State<'_, AppState>) -> CmdResult<Diagnostics> {
    let info = os_info::get();
    let os = OsSummary { name: info.os_type().to_string(), version: info.version().to_string(), arch: std::env::consts::ARCH.to_string() };
    let config_dir = app.path().app_config_dir().map(|p| p.display().to_string()).unwrap_or_default();
    let log_dir = app.try_state::<crate::LogState>().and_then(|l| l.dir.as_ref().map(|d| d.display().to_string())).unwrap_or_default();

    let device = {
        let m = state.manager.lock();
        let st = m.state();
        DeviceSummary {
            status: format!("{:?}", st.status).to_lowercase(),
            model: st.device.as_ref().map(|d| d.model_name.clone()),
            input: st.device.as_ref().map(|d| d.input_name.clone()),
            output: st.device.as_ref().map(|d| d.output_name.clone()),
            firmware: st.device.as_ref().and_then(|d| d.firmware.clone()),
            is_virtual: st.device.as_ref().map(|d| d.is_virtual).unwrap_or(false),
            error: st.error.clone(),
            auto_connect: st.auto_connect,
            remembered: st.saved_device.as_ref().map(|d| if d.is_virtual { format!("virtual {}", d.model) } else { format!("{} on {}", d.model, d.input_name) }),
        }
    };

    let (midi_inputs, midi_outputs, midi_error) = match (list_inputs(), list_outputs()) {
        (Ok(i), Ok(o)) => (i.into_iter().map(|p| p.name).collect(), o.into_iter().map(|p| p.name).collect(), None),
        (i, o) => (
            i.unwrap_or_default().into_iter().map(|p| p.name).collect(),
            o.unwrap_or_default().into_iter().map(|p| p.name).collect(),
            Some("MIDI ports could not be listed".to_string()),
        ),
    };

    let audio_devices = state.audio.devices().await;
    let settings = state.settings.lock().settings.clone();
    let audio = AudioSummary { default_device: audio_devices.default.clone(), devices: audio_devices.devices.clone(), configured: settings.audio.output_device.clone() };

    let obs = state.obs.state();
    let slobs = state.slobs.state();
    let integrations = vec![
        IntegrationSummary {
            name: "OBS Studio".into(),
            enabled: settings.obs.enabled,
            endpoint: format!("{}:{}", settings.obs.host, settings.obs.port),
            connected: obs.connected,
            error: obs.error.clone(),
        },
        IntegrationSummary {
            name: "Streamlabs Desktop".into(),
            enabled: settings.slobs.enabled,
            endpoint: format!("{}:{}", settings.slobs.host, settings.slobs.port),
            connected: slobs.connected,
            error: slobs.error.clone(),
        },
    ];

    let profile = {
        let store = state.profile.lock();
        let pages = &store.profile.pages;
        ProfileSummary {
            pages: pages.len(),
            buttons: pages.iter().map(|p| p.buttons.len()).sum(),
            actions: pages.iter().flat_map(|p| p.buttons.iter()).map(|b| b.button.down.len() + b.button.up.len() + b.button.hold.len()).sum(),
        }
    };

    let ptt = &settings.push_to_talk;
    let push_to_talk = if ptt.enabled && !ptt.key.is_empty() {
        Some(ptt.modifiers.iter().cloned().chain(std::iter::once(ptt.key.clone())).collect::<Vec<_>>().join("+"))
    } else {
        None
    };

    Ok(Diagnostics {
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        tauri_version: tauri::VERSION.to_string(),
        webview_version: tauri::webview_version().ok(),
        os,
        config_dir,
        log_dir,
        device,
        midi_inputs,
        midi_outputs,
        midi_error,
        audio,
        integrations,
        profile,
        settings: SettingsSummary {
            developer_mode: settings.developer_mode,
            push_to_talk,
            stay_on_top: settings.window.stay_on_top,
            minimize_to_tray: settings.window.minimize_to_tray,
            run_at_startup: settings.window.run_at_startup,
        },
    })
}
