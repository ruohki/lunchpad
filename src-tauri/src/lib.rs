//! Lunchpad backend.
//!
//! Module map (each module is also a log category, e.g. `lunchpad_lib::midi`):
//! * `midi`     - device discovery, Launchpad drivers, live connection, LED renderer
//! * `profile`  - pages and buttons (`profile.json`), legacy importer
//! * `macros`   - action model (engine arrives in stage 3)
//! * `config`   - persisted settings
//! * `commands` - Tauri command layer

pub mod audio;
pub mod audio_devices;
mod commands;
pub mod config;
pub mod debug;
pub mod desktop;
pub mod http;
pub mod input;
pub mod live;
pub mod macros;
pub mod midi;
pub mod obs;
pub mod profile;
pub mod script;
pub mod homeassistant;
pub mod hub;
pub mod secrets;
pub mod slobs;
pub mod speech;
pub mod system_volume;
pub mod tray;

use commands::*;
use config::{SettingsStore, SharedSettings};
use input::{spawn_keyboard, SharedKeyboard};
use macros::{EngineSink, MacroEngine, RunningMacro, Services};
use midi::render::RenderHandle;
use midi::{spawn_watcher, DeviceManager, MidiAnchor, SharedManager};
use parking_lot::Mutex;
use profile::{Profile, ProfileStore};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, WindowEvent};

pub const EVENT_MACROS: &str = "macro:running";
pub const EVENT_VARIABLES: &str = "vars:changed";

/// Connects the macro engine to the window, the LEDs and the keyboard.
struct TauriSink {
    app: AppHandle,
    render_slot: Arc<Mutex<Option<RenderHandle>>>,
    settings: SharedSettings,
    keyboard: SharedKeyboard,
    /// `variables.json` in the config folder: shared variables survive restarts.
    variables_path: std::path::PathBuf,
}

impl EngineSink for TauriSink {
    fn running_changed(&self, running: &[RunningMacro]) {
        let _ = self.app.emit(EVENT_MACROS, running);
    }
    fn profile_changed(&self, profile: &Profile) {
        let _ = self.app.emit(commands::EVENT_PROFILE, profile);
    }
    fn repaint(&self) {
        if let Some(render) = self.render_slot.lock().as_ref() {
            render.repaint();
        }
    }
    fn push_to_talk(&self, held: bool) {
        let ptt = self.settings.lock().settings.push_to_talk.clone();
        if !ptt.enabled || ptt.key.is_empty() {
            return;
        }
        tracing::debug!(held, key = %ptt.key, modifiers = ?ptt.modifiers, "push-to-talk");
        if held {
            self.keyboard.hold(&ptt.key, &ptt.modifiers);
        } else {
            self.keyboard.release(&ptt.key, &ptt.modifiers);
        }
    }
    fn push_to_talk_enabled(&self) -> bool {
        let ptt = &self.settings.lock().settings.push_to_talk;
        ptt.enabled && !ptt.key.is_empty()
    }
    fn variables_changed(&self, globals: &std::collections::HashMap<String, String>) {
        let _ = self.app.emit(EVENT_VARIABLES, globals);
        match serde_json::to_string_pretty(globals) {
            Ok(json) => {
                if let Err(e) = std::fs::write(&self.variables_path, json) {
                    tracing::warn!(error = %e, "variables could not be saved");
                }
            }
            Err(e) => tracing::warn!(error = %e, "variables could not be serialised"),
        }
    }
}

/// Where the log files go: the platform's log folder for the app identifier
/// (the same place Tauri's `app_log_dir` resolves to), computed before the app
/// exists so the earliest lines are captured too.
fn log_dir() -> Option<std::path::PathBuf> {
    use std::path::PathBuf;
    #[cfg(target_os = "macos")]
    {
        std::env::var_os("HOME").map(|h| PathBuf::from(h).join("Library/Logs/com.lunchpad.app"))
    }
    #[cfg(target_os = "windows")]
    {
        std::env::var_os("LOCALAPPDATA").map(|d| PathBuf::from(d).join("com.lunchpad.app").join("logs"))
    }
    #[cfg(target_os = "linux")]
    {
        std::env::var_os("XDG_DATA_HOME")
            .map(PathBuf::from)
            .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".local/share")))
            .map(|d| d.join("com.lunchpad.app/logs"))
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        None
    }
}

/// Keeps the log writer alive and tells the diagnostics where the files are.
pub struct LogState {
    _guard: Option<tracing_appender::non_blocking::WorkerGuard>,
    pub dir: Option<std::path::PathBuf>,
}

/// Console output plus daily log files (seven kept) in the app's log folder.
fn init_tracing() -> LogState {
    use tracing_subscriber::prelude::*;
    let filter = tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info,lunchpad_lib=info,midir=warn"));
    let stdout = tracing_subscriber::fmt::layer().with_target(true).with_line_number(true).with_file(false).compact();
    let dir = log_dir();
    let file = dir.as_ref().and_then(|dir| {
        std::fs::create_dir_all(dir).ok()?;
        let appender = tracing_appender::rolling::Builder::new()
            .rotation(tracing_appender::rolling::Rotation::DAILY)
            .max_log_files(7)
            .filename_prefix("lunchpad")
            .filename_suffix("log")
            .build(dir)
            .ok()?;
        let (writer, guard) = tracing_appender::non_blocking(appender);
        Some((tracing_subscriber::fmt::layer().with_writer(writer).with_ansi(false).with_target(true).compact(), guard))
    });
    match file {
        Some((layer, guard)) => {
            tracing_subscriber::registry().with(filter).with(stdout).with(layer).init();
            LogState { _guard: Some(guard), dir }
        }
        None => {
            tracing_subscriber::registry().with(filter).with(stdout).init();
            LogState { _guard: None, dir }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let log_state = init_tracing();
    tracing::info!(version = env!("CARGO_PKG_VERSION"), log_dir = ?log_state.dir, "starting Lunchpad");

    tauri::Builder::default()
        // One copy at a time: a second launch (the Start menu, a Dock click while the app sits in
        // the tray) hands over to the running copy, which brings its window forward, and quits.
        // Registered first so nothing else of the duplicate starts up.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| tray::show_main(app)))
        .manage(log_state)
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        // The window comes back where and how it was left: size, position and whether it was
        // maximized. Visibility is not part of it; "start hidden" decides that.
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(tauri_plugin_window_state::StateFlags::SIZE | tauri_plugin_window_state::StateFlags::POSITION | tauri_plugin_window_state::StateFlags::MAXIMIZED)
                .build(),
        )
        .on_window_event(|window, event| {
            // "Minimize to tray": closing hides the window; the tray brings it back.
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == tray::MAIN_WINDOW && tray::hides_on_close(window.app_handle()) {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .setup(|app| {
            // CoreMIDI drops its server connection when the last client of a
            // process is disposed, after which port enumeration returns nothing.
            // Keep one client alive for the whole process, created on the main
            // thread, so every later enumeration sees the real device list.
            app.manage(MidiAnchor::new());
            app.manage(debug::DebugTexts::default());

            let config_dir = app.path().app_config_dir().expect("app config dir");
            let settings: SharedSettings = Arc::new(Mutex::new(SettingsStore::load(&config_dir)));
            let profile = Arc::new(Mutex::new(ProfileStore::load(&config_dir)));
            let manager: SharedManager =
                Arc::new(Mutex::new(DeviceManager::new(app.handle().clone(), settings.clone(), profile.clone())));
            let keyboard: SharedKeyboard = Arc::new(spawn_keyboard(Some(app.handle().clone())));
            let audio = audio::spawn_audio();
            let speech = speech::spawn_speech();
            let runtime = tauri::async_runtime::handle().inner().clone();
            let (running_pads, render_slot, shared_live) = {
                let m = manager.lock();
                (m.running_pads(), m.render_slot(), m.live())
            };
            // State-linked button colours: repaint the LEDs whenever OBS / Streamlabs change.
            let live = {
                let render_slot = render_slot.clone();
                live::LiveHandle::new(
                    shared_live,
                    Arc::new(move || {
                        if let Some(render) = render_slot.lock().as_ref() {
                            render.repaint();
                        }
                    }),
                )
            };
            let obs = obs::ObsHandle::spawn(Some(app.handle().clone()), settings.clone(), &runtime, Some(live.clone()));
            let slobs = slobs::SlobsHandle::spawn(Some(app.handle().clone()), settings.clone(), &runtime, Some(live));
            let home_assistant = homeassistant::HaHandle::spawn(Some(app.handle().clone()), settings.clone(), &runtime);
            let hub = hub::HubHandle::spawn(app.handle().clone(), settings.clone());

            let sink = Arc::new(TauriSink {
                app: app.handle().clone(),
                render_slot,
                settings: settings.clone(),
                keyboard: keyboard.clone(),
                variables_path: config_dir.join("variables.json"),
            });
            let services = Services {
                audio: Some(audio.clone()),
                keyboard: Some((*keyboard).clone()),
                speech: Some(speech.clone()),
                obs: Some(obs.clone()),
                slobs: Some(slobs.clone()),
                home_assistant: Some(home_assistant.clone()),
                settings: Some(settings.clone()),
                downloads: Some(http::download_dir(app.handle())),
                config_dir: Some(config_dir.clone()),
                app: Some(app.handle().clone()),
            };
            let engine = MacroEngine::new(profile.clone(), running_pads, sink, services, runtime);
            // Shared variables survive restarts.
            if let Ok(text) = std::fs::read_to_string(config_dir.join("variables.json")) {
                match serde_json::from_str::<std::collections::HashMap<String, String>>(&text) {
                    Ok(globals) => {
                        engine.set_globals(globals);
                        engine.prune_fader_variables();
                    }
                    Err(e) => tracing::warn!(error = %e, "variables.json unreadable, starting empty"),
                }
            }
            {
                let for_buttons = engine.clone();
                manager.lock().add_button_listener(Arc::new(move |event| for_buttons.on_button(event)));
                let for_pressure = engine.clone();
                manager.lock().add_pressure_listener(Arc::new(move |event| for_pressure.on_pressure(event)));
                let for_controls = engine.clone();
                manager.lock().add_control_listener(Arc::new(move |event| for_controls.on_control(event)));
                let for_state = engine.clone();
                manager.lock().add_state_listener(Arc::new(move |state| for_state.set_device(state.device.clone())));
                engine.set_device(manager.lock().state().device);
            }

            let window_settings = settings.lock().settings.window.clone();
            app.manage(AppState { manager: manager.clone(), profile, settings, engine, keyboard, audio, speech, obs, slobs, home_assistant, hub, history: Mutex::new(Vec::new()), redo: Mutex::new(Vec::new()) });
            if let Err(e) = tray::setup(app.handle(), &window_settings) {
                tracing::warn!(error = %e, "tray icon could not be created");
            }
            // The window is created hidden; "start hidden" keeps it in the tray.
            if !window_settings.start_hidden {
                tray::show_main(app.handle());
            }

            // Auto-connect happens on the watcher thread so the window opens
            // immediately; the UI receives `device:state` as soon as it is done.
            spawn_watcher(app.handle().clone(), manager);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // device
            scan_launchpads,
            connect_launchpad,
            connect_virtual,
            disconnect_launchpad,
            get_device_state,
            set_auto_connect,
            set_press_feedback,
            set_press_threshold,
            forget_device,
            get_layout,
            list_models,
            list_midi_ports,
            list_windows,
            foreground_window,
            list_screens,
            debug_text,
            press_pad,
            control_pad,
            reset_leds,
            send_raw_midi,
            // profile
            get_profile,
            set_active_page,
            add_page,
            rename_page,
            remove_page,
            duplicate_page,
            move_page,
            set_button,
            clear_button,
            set_fader,
            remove_fader,
            move_fader,
            undo_profile,
            redo_profile,
            history_state,
            missing_sound_files,
            move_button,
            import_legacy_json,
            import_legacy_file,
            export_page,
            export_page_file,
            export_profile_file,
            export_button_file,
            import_page_json,
            review_import_json,
            review_import_file,
            import_page_file,
            restore_profile_backup,
            read_image_data_uri,
            // macros
            get_running_macros,
            stop_all_macros,
            stop_macros_at,
            run_button,
            // settings
            get_settings,
            set_push_to_talk,
            check_keyboard_access,
            set_developer_mode,
            set_secret,
            delete_secret,
            set_window_settings,
            set_tray_labels,
            diagnostics,
            open_log_dir,
            // media
            list_audio_devices,
            list_system_audio_devices,
            analyze_audio,
            preview_sound,
            stop_sound,
            stop_all_sounds,
            set_audio_settings,
            file_name,
            list_voices,
            preview_speech,
            stop_speech,
            obs_state,
            obs_connect,
            obs_disconnect,
            obs_refresh,
            obs_filters,
            obs_hotkeys,
            set_obs_settings,
            slobs_state,
            slobs_connect,
            slobs_disconnect,
            slobs_refresh,
            slobs_filters,
            set_slobs_settings,
            home_assistant_state,
            home_assistant_refresh,
            set_home_assistant_settings,
            test_http_request,
            download_cache_info,
            clear_download_cache,
            open_download_folder,
            test_script,
            get_variables,
            builtin_info,
            delete_variables,
            set_variable,
            clear_variables,
            prune_fader_variables,
            // hub
            hub_state,
            hub_link_start,
            hub_link_cancel,
            hub_sign_out,
            hub_set_url,
            hub_fetch_listing,
            hub_dismiss_delivery,
            hub_review_delivery,
            hub_apply_delivery,
            hub_share,
            hub_update_listing,
            hub_sync_shared,
            hub_forget_shared,
            hub_backup_now,
            hub_list_backups,
            hub_delete_backup,
            hub_restore_backup,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // macOS: clicking the dock icon while the window is hidden brings it back.
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen { has_visible_windows, .. } = event {
                if !has_visible_windows {
                    tray::show_main(app);
                }
            }
            #[cfg(not(target_os = "macos"))]
            let _ = (app, event);
        });
}
