//! Owns the live connection to a Launchpad and keeps the UI informed.
//!
//! Threads involved:
//! * midir's input callback thread: parses presses, updates the pressed set,
//!   emits `device:button` and forwards to registered listeners.
//! * an output thread that owns the `MidiOutputConnection` and drains a
//!   channel, so any part of the app can send without locking the manager.
//! * a watcher thread (see [`spawn_watcher`]) that polls the OS port list to
//!   detect unplugging and to auto-connect the remembered device.

use super::models::{driver_for, LaunchpadDriver};
use super::render::{spawn_renderer, RenderHandle, RenderInputs};
use crate::live::SharedLive;
use super::scan::{self, port_fingerprint};
use super::types::*;
use crate::config::{SavedDevice, SharedSettings};
use crate::profile::ProfileStore;
use crossbeam_channel::{unbounded, Sender};
use midir::{Ignore, MidiInput, MidiInputConnection, MidiOutput};
use parking_lot::Mutex;
use serde::Serialize;
use std::collections::HashSet;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

pub const EVENT_STATE: &str = "device:state";
pub const EVENT_BUTTON: &str = "device:button";
pub const EVENT_RAW: &str = "midi:raw";
pub const EVENT_PORTS_CHANGED: &str = "midi:ports-changed";

const PRESS_COLOR: Color = super::render::PRESS_COLOR;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ConnectionStatus {
    Disconnected,
    Connecting,
    Connected,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectedDevice {
    pub model: LaunchpadModel,
    pub model_name: String,
    pub input_name: String,
    pub output_name: String,
    pub firmware: Option<String>,
    /// No hardware: the pads on screen drive the macros.
    #[serde(rename = "virtual")]
    pub is_virtual: bool,
}

/// Snapshot of everything the UI needs to render the connection area.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceState {
    pub status: ConnectionStatus,
    pub device: Option<ConnectedDevice>,
    pub layout: Option<Layout>,
    pub saved_device: Option<SavedDevice>,
    pub auto_connect: bool,
    pub press_feedback: bool,
    /// Custom press threshold, `None` = model default
    pub press_threshold: Option<u8>,
    pub pressed: Vec<(u8, u8)>,
    pub error: Option<String>,
}

enum OutCmd {
    Send(Vec<u8>),
    Close,
}

/// Cloneable handle for sending MIDI to the connected device.
#[derive(Clone)]
pub struct OutputHandle {
    tx: Sender<OutCmd>,
    driver: Arc<dyn LaunchpadDriver>,
}

impl OutputHandle {
    pub fn send_raw(&self, msg: Vec<u8>) -> MidiResult<()> {
        self.tx.send(OutCmd::Send(msg)).map_err(|_| MidiError::Send("output closed".into()))
    }

    pub fn set_colors(&self, pads: &[(u8, u8, Color)]) -> MidiResult<()> {
        for msg in self.driver.color_messages(pads) {
            self.send_raw(msg)?;
        }
        Ok(())
    }

    pub fn set_leds(&self, leds: &[(u8, u8, LedColor)]) -> MidiResult<()> {
        for msg in self.driver.led_messages(leds) {
            self.send_raw(msg)?;
        }
        Ok(())
    }

    pub fn clear(&self) -> MidiResult<()> {
        for msg in self.driver.clear_messages() {
            self.send_raw(msg)?;
        }
        Ok(())
    }
}

pub type ButtonListener = Arc<dyn Fn(&ButtonEvent) + Send + Sync>;
pub type PressureListener = Arc<dyn Fn(&PressureEvent) + Send + Sync>;
pub const EVENT_PRESSURE: &str = "device:pressure";

struct Active {
    /// `None` for a virtual Launchpad.
    _input: Option<MidiInputConnection<()>>,
    output: OutputHandle,
    info: ConnectedDevice,
    pressed: Arc<Mutex<HashSet<(u8, u8)>>>,
    render: RenderHandle,
    driver: Arc<dyn LaunchpadDriver>,
}

pub struct DeviceManager {
    app: AppHandle,
    settings: SharedSettings,
    profile: Arc<Mutex<ProfileStore>>,
    /// Renderer of the current connection, shared so other subsystems can ask
    /// for a repaint without taking the manager lock.
    render_slot: Arc<Mutex<Option<RenderHandle>>>,
    /// Pads with a running macro (maintained by the macro engine, stage 3).
    running: Arc<Mutex<HashSet<(String, u8, u8)>>>,
    active: Option<Active>,
    status: ConnectionStatus,
    last_error: Option<String>,
    listeners: Arc<Mutex<Vec<ButtonListener>>>,
    pressure_listeners: Arc<Mutex<Vec<PressureListener>>>,
    press_feedback: Arc<Mutex<bool>>,
    /// Velocity that counts as a press; `None` = the model's default.
    press_threshold: Arc<Mutex<Option<u8>>>,
    live: SharedLive,
    next_auto_connect: Instant,
}

pub type SharedManager = Arc<Mutex<DeviceManager>>;

/// Process-lifetime MIDI clients. On macOS, CoreMIDI tears down the
/// connection to the MIDI server once the last client is disposed, and
/// `MIDIGetNumberOfSources` then reports zero ports until a client is
/// created on a thread that runs a run loop. Holding one client for the
/// whole process (created on the main thread) avoids that.
pub struct MidiAnchor {
    _input: Mutex<Option<MidiInput>>,
    _output: Mutex<Option<MidiOutput>>,
}

impl MidiAnchor {
    pub fn new() -> Self {
        // Right after a restart, or while a device is being plugged in, the
        // MIDI server can refuse a client for a moment; try a few times.
        let mut input = None;
        let mut output = None;
        let mut last_error = String::new();
        for attempt in 0..10 {
            if input.is_none() {
                match MidiInput::new("Lunchpad anchor") {
                    Ok(i) => input = Some(i),
                    Err(e) => last_error = e.to_string(),
                }
            }
            if output.is_none() {
                match MidiOutput::new("Lunchpad anchor") {
                    Ok(o) => output = Some(o),
                    Err(e) => last_error = e.to_string(),
                }
            }
            if input.is_some() && output.is_some() {
                if attempt > 0 {
                    tracing::info!(attempt = attempt + 1, "MIDI anchor client created after retrying");
                }
                break;
            }
            std::thread::sleep(Duration::from_millis(250));
        }
        if input.is_none() || output.is_none() {
            tracing::warn!(error = %last_error, "could not create the MIDI anchor client; MIDI may stay unavailable until restart");
        }
        MidiAnchor { _input: Mutex::new(input), _output: Mutex::new(output) }
    }
}

impl Default for MidiAnchor {
    fn default() -> Self {
        Self::new()
    }
}

impl DeviceManager {
    pub fn new(app: AppHandle, settings: SharedSettings, profile: Arc<Mutex<ProfileStore>>) -> Self {
        let (press_feedback, press_threshold) = {
            let st = settings.lock();
            (st.settings.press_feedback, st.settings.press_threshold)
        };
        DeviceManager {
            app,
            settings,
            profile,
            render_slot: Arc::new(Mutex::new(None)),
            running: Arc::new(Mutex::new(HashSet::new())),
            active: None,
            status: ConnectionStatus::Disconnected,
            last_error: None,
            listeners: Arc::new(Mutex::new(Vec::new())),
            pressure_listeners: Arc::new(Mutex::new(Vec::new())),
            press_feedback: Arc::new(Mutex::new(press_feedback)),
            press_threshold: Arc::new(Mutex::new(press_threshold)),
            live: Arc::new(Mutex::new(Default::default())),
            next_auto_connect: Instant::now(),
        }
    }

    /// Streaming app state the LED renderer reads for state-linked buttons.
    pub fn live(&self) -> SharedLive {
        self.live.clone()
    }

    // ----- state -----------------------------------------------------------

    pub fn state(&self) -> DeviceState {
        let (device, layout, pressed) = match &self.active {
            Some(a) => (
                Some(a.info.clone()),
                Some(a.output.driver.layout()),
                a.pressed.lock().iter().copied().collect(),
            ),
            None => (None, None, Vec::new()),
        };
        let (saved_device, auto_connect) = {
            let st = self.settings.lock();
            (st.settings.device.clone(), st.settings.auto_connect)
        };
        DeviceState {
            status: self.status,
            device,
            layout,
            saved_device,
            auto_connect,
            press_feedback: *self.press_feedback.lock(),
            press_threshold: *self.press_threshold.lock(),
            pressed,
            error: self.last_error.clone(),
        }
    }

    fn emit_state(&self) {
        if let Err(e) = self.app.emit(EVENT_STATE, self.state()) {
            tracing::warn!(error = %e, "failed to emit device state");
        }
    }

    #[allow(dead_code)] // used by the macro engine (stage 2)
    pub fn is_connected(&self) -> bool {
        self.active.is_some()
    }

    pub fn connected_port_names(&self) -> Vec<String> {
        match &self.active {
            Some(a) => vec![a.info.input_name.clone(), a.info.output_name.clone()],
            None => Vec::new(),
        }
    }

    pub fn output(&self) -> Option<OutputHandle> {
        self.active.as_ref().map(|a| a.output.clone())
    }

    pub fn add_button_listener(&self, listener: ButtonListener) {
        self.listeners.lock().push(listener);
    }

    pub fn add_pressure_listener(&self, listener: PressureListener) {
        self.pressure_listeners.lock().push(listener);
    }

    /// Change the press threshold (`None` = model default) and remember it.
    pub fn set_press_threshold(&mut self, threshold: Option<u8>) -> MidiResult<()> {
        *self.press_threshold.lock() = threshold;
        let mut st = self.settings.lock();
        st.settings.press_threshold = threshold;
        st.save()
    }

    pub fn press_threshold(&self) -> Option<u8> {
        *self.press_threshold.lock()
    }

    /// Shared set of pads with a running macro; the renderer shows their
    /// active colour. The macro engine mutates it.
    pub fn running_pads(&self) -> Arc<Mutex<HashSet<(String, u8, u8)>>> {
        self.running.clone()
    }

    /// Ask the LED renderer to repaint the active page (no-op when disconnected).
    pub fn request_repaint(&self) {
        if let Some(a) = &self.active {
            a.render.repaint();
        }
    }

    /// Slot holding the current connection's renderer; `None` while disconnected.
    pub fn render_slot(&self) -> Arc<Mutex<Option<RenderHandle>>> {
        self.render_slot.clone()
    }

    /// Turn every LED off and repaint from scratch.
    pub fn reset_leds(&self) -> MidiResult<()> {
        let a = self.active.as_ref().ok_or(MidiError::NotConnected)?;
        a.output.clear()?;
        a.render.reset();
        Ok(())
    }

    /// Treat a click in the UI exactly like a press on the hardware.
    pub fn simulate_press(&self, x: u8, y: u8, pressed: bool) -> MidiResult<()> {
        let a = self.active.as_ref().ok_or(MidiError::NotConnected)?;
        let (note, cc) = a.driver.xy_to_note(x, y).unwrap_or((0, false));
        let event = ButtonEvent { x, y, pressed, note, cc, value: if pressed { 127 } else { 0 } };
        {
            let mut set = a.pressed.lock();
            if pressed {
                set.insert((x, y));
            } else {
                set.remove(&(x, y));
            }
        }
        a.render.repaint();
        let _ = self.app.emit(EVENT_BUTTON, event);
        for listener in self.listeners.lock().iter() {
            listener(&event);
        }
        Ok(())
    }

    // ----- settings --------------------------------------------------------

    pub fn saved_device(&self) -> Option<SavedDevice> {
        self.settings.lock().settings.device.clone()
    }

    pub fn auto_connect_enabled(&self) -> bool {
        self.settings.lock().settings.auto_connect
    }

    pub fn set_auto_connect(&mut self, enabled: bool) -> MidiResult<()> {
        {
            let mut st = self.settings.lock();
            st.settings.auto_connect = enabled;
            st.save()?;
        }
        self.next_auto_connect = Instant::now();
        self.emit_state();
        Ok(())
    }

    pub fn set_press_feedback(&mut self, enabled: bool) -> MidiResult<()> {
        *self.press_feedback.lock() = enabled;
        {
            let mut st = self.settings.lock();
            st.settings.press_feedback = enabled;
            st.save()?;
        }
        self.request_repaint();
        self.emit_state();
        Ok(())
    }

    pub fn forget_device(&mut self) -> MidiResult<()> {
        self.disconnect();
        {
            let mut st = self.settings.lock();
            st.settings.device = None;
            st.save()?;
        }
        self.emit_state();
        Ok(())
    }

    // ----- scanning --------------------------------------------------------

    /// Scan for Launchpads, marking the connected one instead of re-probing it.
    pub fn scan(exclude: &[String], connected: Option<&ConnectedDevice>) -> MidiResult<Vec<DiscoveredLaunchpad>> {
        let mut found = scan::scan_launchpads(exclude)?;
        if let Some(c) = connected {
            let inputs = scan::list_inputs()?;
            let outputs = scan::list_outputs()?;
            let input = inputs.into_iter().find(|p| p.name == c.input_name);
            let output = outputs.into_iter().find(|p| p.name == c.output_name);
            if let (Some(input), Some(output)) = (input, output) {
                found.insert(
                    0,
                    DiscoveredLaunchpad {
                        model: c.model,
                        model_name: c.model_name.clone(),
                        input,
                        output,
                        firmware: c.firmware.clone(),
                        identified_by: IdentificationSource::DeviceInquiry,
                        inquiry_reply: None,
                        connected: true,
                    },
                );
            }
        }
        Ok(found)
    }

    // ----- connecting ------------------------------------------------------

    /// Open the given port pair as `model`, remember it, and light it up.
    pub fn connect(&mut self, input_name: &str, output_name: &str, model: LaunchpadModel, firmware: Option<String>) -> MidiResult<()> {
        self.disconnect_quiet();
        self.status = ConnectionStatus::Connecting;
        self.last_error = None;
        self.emit_state();

        match self.open(input_name, output_name, model, firmware) {
            Ok(active) => {
                let info = active.info.clone();
                *self.render_slot.lock() = Some(active.render.clone());
                self.active = Some(active);
                self.status = ConnectionStatus::Connected;
                {
                    let mut st = self.settings.lock();
                    st.settings.device = Some(SavedDevice {
                        input_name: info.input_name.clone(),
                        output_name: info.output_name.clone(),
                        model: info.model,
                        firmware: info.firmware.clone(),
                        is_virtual: false,
                    });
                    if let Err(e) = st.save() {
                        tracing::warn!(error = %e, "could not persist device selection");
                    }
                }
                tracing::info!(model = %info.model, input = %info.input_name, output = %info.output_name, "connected");
                self.emit_state();
                Ok(())
            }
            Err(e) => {
                self.status = ConnectionStatus::Disconnected;
                self.last_error = Some(e.to_string());
                tracing::warn!(error = %e, "connect failed");
                self.emit_state();
                Err(e)
            }
        }
    }

    /// Reconnect to the remembered device, verifying with a device inquiry
    /// that the ports still belong to the same model.
    /// Use a model's layout without hardware: the pads on screen run the
    /// macros, LED messages go to a drain so the render path stays the same.
    pub fn connect_virtual(&mut self, model: LaunchpadModel) -> MidiResult<()> {
        self.disconnect_quiet();
        self.last_error = None;
        let driver: Arc<dyn LaunchpadDriver> = Arc::from(driver_for(model));
        let (tx, rx) = unbounded::<OutCmd>();
        std::thread::Builder::new()
            .name("lunchpad-virtual-out".into())
            .spawn(move || {
                while let Ok(cmd) = rx.recv() {
                    if matches!(cmd, OutCmd::Close) {
                        break;
                    }
                }
            })
            .map_err(|e| MidiError::Init(e.to_string()))?;
        let output = OutputHandle { tx, driver: driver.clone() };
        let pressed = Arc::new(Mutex::new(HashSet::<(u8, u8)>::new()));
        let render = spawn_renderer(
            output.clone(),
            driver.layout(),
            RenderInputs {
                profile: self.profile.clone(),
                pressed: pressed.clone(),
                running: self.running.clone(),
                press_feedback: self.press_feedback.clone(),
                live: self.live.clone(),
            },
        );
        let info = ConnectedDevice {
            model,
            model_name: model.display_name().to_string(),
            input_name: String::new(),
            output_name: String::new(),
            firmware: None,
            is_virtual: true,
        };
        *self.render_slot.lock() = Some(render.clone());
        self.active = Some(Active { _input: None, output, info, pressed, render, driver });
        self.status = ConnectionStatus::Connected;
        {
            let mut st = self.settings.lock();
            st.settings.device = Some(SavedDevice { input_name: String::new(), output_name: String::new(), model, firmware: None, is_virtual: true });
            if let Err(e) = st.save() {
                tracing::warn!(error = %e, "could not persist device selection");
            }
        }
        tracing::info!(model = %model, "virtual Launchpad started");
        self.emit_state();
        Ok(())
    }

    pub fn connect_saved(&mut self) -> MidiResult<bool> {
        let Some(saved) = self.saved_device() else { return Ok(false) };
        if saved.is_virtual {
            self.connect_virtual(saved.model)?;
            return Ok(true);
        }
        let ports = port_fingerprint();
        if !ports.contains(&format!("in:{}", saved.input_name)) || !ports.contains(&format!("out:{}", saved.output_name)) {
            return Ok(false);
        }
        let found = scan::scan_launchpads(&[])?;
        let matching = found.into_iter().find(|d| d.input.name == saved.input_name && d.output.name == saved.output_name);
        match matching {
            Some(d) if d.model == saved.model => {
                self.connect(&d.input.name, &d.output.name, d.model, d.firmware)?;
                Ok(true)
            }
            Some(d) => Err(MidiError::Verification(format!(
                "ports of the remembered {} now belong to a {}",
                saved.model, d.model
            ))),
            None => Err(MidiError::Verification("remembered device did not answer the device inquiry".into())),
        }
    }

    fn open(&self, input_name: &str, output_name: &str, model: LaunchpadModel, firmware: Option<String>) -> MidiResult<Active> {
        let driver: Arc<dyn LaunchpadDriver> = Arc::from(driver_for(model));

        let mut midi_in = MidiInput::new("Lunchpad").map_err(|e| MidiError::Init(e.to_string()))?;
        midi_in.ignore(Ignore::None);
        let midi_out = MidiOutput::new("Lunchpad").map_err(|e| MidiError::Init(e.to_string()))?;

        let in_port = midi_in
            .ports()
            .into_iter()
            .find(|p| midi_in.port_name(p).map(|n| n == input_name).unwrap_or(false))
            .ok_or_else(|| MidiError::PortNotFound(input_name.to_string()))?;
        let out_port = midi_out
            .ports()
            .into_iter()
            .find(|p| midi_out.port_name(p).map(|n| n == output_name).unwrap_or(false))
            .ok_or_else(|| MidiError::PortNotFound(output_name.to_string()))?;

        // Output thread ------------------------------------------------------
        let mut out_conn = midi_out.connect(&out_port, "lunchpad-out").map_err(|e| MidiError::Connection(e.to_string()))?;
        let (tx, rx) = unbounded::<OutCmd>();
        std::thread::Builder::new()
            .name("lunchpad-midi-out".into())
            .spawn(move || {
                while let Ok(cmd) = rx.recv() {
                    match cmd {
                        OutCmd::Send(msg) => {
                            tracing::trace!(msg = %hex(&msg), "midi out");
                            if let Err(e) = out_conn.send(&msg) {
                                tracing::warn!(error = %e, "midi send failed");
                            }
                        }
                        OutCmd::Close => break,
                    }
                }
                tracing::debug!("midi output thread finished");
            })
            .map_err(|e| MidiError::Init(e.to_string()))?;

        let output = OutputHandle { tx, driver: driver.clone() };

        // LED renderer -------------------------------------------------------
        let pressed = Arc::new(Mutex::new(HashSet::<(u8, u8)>::new()));
        let render = spawn_renderer(
            output.clone(),
            driver.layout(),
            RenderInputs {
                profile: self.profile.clone(),
                pressed: pressed.clone(),
                running: self.running.clone(),
                press_feedback: self.press_feedback.clone(),
                live: self.live.clone(),
            },
        );

        // Input callback -----------------------------------------------------
        let cb_pressed = pressed.clone();
        let cb_driver = driver.clone();
        let cb_render = render.clone();
        let cb_app = self.app.clone();
        let cb_listeners = self.listeners.clone();
        let cb_pressure_listeners = self.pressure_listeners.clone();
        let cb_threshold = self.press_threshold.clone();

        let input = midi_in
            .connect(
                &in_port,
                "lunchpad-in",
                move |timestamp, msg, _| {
                    let _ = cb_app.emit(EVENT_RAW, RawMidiEvent { timestamp, bytes: msg.to_vec(), hex: hex(msg) });
                    let threshold = cb_threshold.lock().unwrap_or_else(|| cb_driver.press_threshold());
                    let Some(event) = cb_driver.parse_input_with(msg, threshold) else {
                        // Not a press: maybe aftertouch for the pads being held.
                        let held: Vec<(u8, u8)> = cb_pressed.lock().iter().copied().collect();
                        for pressure in cb_driver.parse_pressure(msg, &held) {
                            tracing::trace!(x = pressure.x, y = pressure.y, value = pressure.value, "aftertouch");
                            let _ = cb_app.emit(EVENT_PRESSURE, pressure);
                            for listener in cb_pressure_listeners.lock().iter() {
                                listener(&pressure);
                            }
                        }
                        return;
                    };
                    {
                        let mut set = cb_pressed.lock();
                        if event.pressed {
                            set.insert((event.x, event.y));
                        } else if !set.remove(&(event.x, event.y)) {
                            // A release for a pad that never counted as pressed (a brush below
                            // the velocity threshold): nothing to release, so nothing to run.
                            tracing::trace!(x = event.x, y = event.y, "release without press ignored");
                            return;
                        }
                    }
                    tracing::debug!(x = event.x, y = event.y, pressed = event.pressed, note = event.note, cc = event.cc, value = event.value, "button");
                    cb_render.repaint();
                    let _ = cb_app.emit(EVENT_BUTTON, event);
                    for listener in cb_listeners.lock().iter() {
                        listener(&event);
                    }
                },
                (),
            )
            .map_err(|e| MidiError::Connection(e.to_string()))?;

        for msg in driver.init_messages() {
            output.send_raw(msg)?;
        }
        wake_up_sweep(output.clone(), driver.layout(), render.clone());

        Ok(Active {
            _input: Some(input),
            render,
            driver: driver.clone(),
            output,
            info: ConnectedDevice {
                model,
                model_name: model.display_name().to_string(),
                input_name: input_name.to_string(),
                output_name: output_name.to_string(),
                firmware,
            is_virtual: false,
        },
            pressed,
        })
    }

    fn disconnect_quiet(&mut self) {
        *self.render_slot.lock() = None;
        if let Some(active) = self.active.take() {
            active.render.close();
            for msg in active.output.driver.unload_messages() {
                let _ = active.output.send_raw(msg);
            }
            let _ = active.output.tx.send(OutCmd::Close);
            tracing::info!(model = %active.info.model, "disconnected");
        }
        self.status = ConnectionStatus::Disconnected;
    }

    /// Close the connection (user initiated). The device stays remembered,
    /// but auto-connect is paused until the user reconnects or it is re-plugged.
    pub fn disconnect(&mut self) {
        self.disconnect_quiet();
        self.last_error = None;
        // Do not immediately auto-reconnect a device the user just closed.
        self.next_auto_connect = Instant::now() + Duration::from_secs(3600);
        self.emit_state();
    }

    /// Called by the watcher when the connected ports vanished from the OS.
    fn device_lost(&mut self) {
        *self.render_slot.lock() = None;
        if let Some(active) = self.active.take() {
            active.render.close();
            let _ = active.output.tx.send(OutCmd::Close);
            tracing::warn!(model = %active.info.model, "device unplugged");
        }
        self.status = ConnectionStatus::Disconnected;
        self.last_error = Some("The Launchpad was unplugged.".into());
        self.next_auto_connect = Instant::now();
        self.emit_state();
    }
}

/// Short diagonal light sweep across the pads right after connecting: a
/// visible confirmation that LED output works, mirroring the UI reveal.
fn wake_up_sweep(output: OutputHandle, layout: Layout, render: RenderHandle) {
    std::thread::spawn(move || {
        let pads: Vec<&PadSpec> = layout
            .pads
            .iter()
            .filter(|p| !matches!(p.shape, PadShape::Empty | PadShape::Logo))
            .collect();
        let max_diag = (layout.width + layout.height) as i32;
        for k in 0..max_diag + 3 {
            let mut frame: Vec<(u8, u8, Color)> = Vec::new();
            for p in &pads {
                let d = p.x as i32 + p.y as i32;
                let color = match k - d {
                    0 => PRESS_COLOR,
                    1 => Color::new(120, 50, 10),
                    2 => Color::new(40, 16, 4),
                    3 => Color::OFF,
                    _ => continue,
                };
                frame.push((p.x, p.y, color));
            }
            if !frame.is_empty() && output.set_colors(&frame).is_err() {
                return;
            }
            std::thread::sleep(Duration::from_millis(28));
        }
        let _ = output.clear();
        render.reset();
    });
}

/// Background thread: hot-plug detection and auto-connect.
pub fn spawn_watcher(app: AppHandle, manager: SharedManager) {
    std::thread::Builder::new()
        .name("lunchpad-midi-watcher".into())
        .spawn(move || {
            let mut last_ports: Option<Vec<String>> = None;
            loop {
                std::thread::sleep(Duration::from_millis(1500));
                let ports = port_fingerprint();
                if last_ports.as_ref() != Some(&ports) {
                    if last_ports.is_some() {
                        tracing::info!(ports = ?ports, "MIDI port list changed");
                        let _ = app.emit(EVENT_PORTS_CHANGED, ());
                    }
                    last_ports = Some(ports.clone());
                }

                let mut m = manager.lock();
                if let Some(active) = &m.active {
                    if active.info.is_virtual {
                        continue;
                    }
                    let in_ok = ports.contains(&format!("in:{}", active.info.input_name));
                    let out_ok = ports.contains(&format!("out:{}", active.info.output_name));
                    if !in_ok || !out_ok {
                        m.device_lost();
                    }
                    continue;
                }

                if !m.auto_connect_enabled() || m.status == ConnectionStatus::Connecting {
                    continue;
                }
                if Instant::now() < m.next_auto_connect {
                    continue;
                }
                let Some(saved) = m.saved_device() else { continue };
                if saved.is_virtual {
                    if let Err(e) = m.connect_virtual(saved.model) {
                        tracing::warn!(error = %e, "virtual Launchpad could not start");
                        m.next_auto_connect = Instant::now() + Duration::from_secs(3600);
                    }
                    continue;
                }
                let present = ports.contains(&format!("in:{}", saved.input_name)) && ports.contains(&format!("out:{}", saved.output_name));
                if !present {
                    continue;
                }
                tracing::info!(model = %saved.model, "remembered device present, auto-connecting");
                match m.connect_saved() {
                    Ok(true) => {}
                    Ok(false) => m.next_auto_connect = Instant::now() + Duration::from_secs(5),
                    Err(e) => {
                        tracing::warn!(error = %e, "auto-connect failed");
                        m.last_error = Some(format!("Auto-connect failed: {e}"));
                        m.next_auto_connect = Instant::now() + Duration::from_secs(10);
                        m.emit_state();
                    }
                }
            }
        })
        .expect("failed to spawn MIDI watcher thread");
}
