//! Settings commands (everything except the device fields, which live in the
//! device commands).

use super::{err, AppState, CmdResult};
use crate::config::{PushToTalkSettings, Settings, WindowSettings};
use crate::tray::{self, TrayLabels};
use tauri::{AppHandle, Emitter, State};

pub const EVENT_SETTINGS: &str = "settings:changed";

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> CmdResult<Settings> {
    Ok(state.settings.lock().settings.clone())
}

#[tauri::command]
pub async fn set_push_to_talk(config: PushToTalkSettings, app: AppHandle, state: State<'_, AppState>) -> CmdResult<Settings> {
    let settings = {
        let mut st = state.settings.lock();
        st.settings.push_to_talk = config;
        st.save().map_err(err)?;
        st.settings.clone()
    };
    let _ = app.emit(EVENT_SETTINGS, &settings);
    Ok(settings)
}

/// Create the keyboard connection now, so the OS permission prompt appears
/// while the user is looking at the settings instead of mid-macro.
#[tauri::command]
pub async fn check_keyboard_access(state: State<'_, AppState>) -> CmdResult<()> {
    state.keyboard.probe();
    Ok(())
}

#[tauri::command]
pub async fn set_window_settings(config: WindowSettings, app: AppHandle, state: State<'_, AppState>) -> CmdResult<Settings> {
    let settings = {
        let mut st = state.settings.lock();
        st.settings.window = config;
        st.save().map_err(err)?;
        st.settings.clone()
    };
    tray::apply(&app, &settings.window);
    let _ = app.emit(EVENT_SETTINGS, &settings);
    Ok(settings)
}

/// Translated labels for the tray menu (Rust has no i18n of its own).
#[tauri::command]
pub async fn set_tray_labels(labels: TrayLabels, app: AppHandle) -> CmdResult<()> {
    tray::set_labels(&app, &labels);
    Ok(())
}

#[tauri::command]
pub async fn set_developer_mode(enabled: bool, app: AppHandle, state: State<'_, AppState>) -> CmdResult<Settings> {
    let settings = {
        let mut st = state.settings.lock();
        st.settings.developer_mode = enabled;
        st.save().map_err(err)?;
        st.settings.clone()
    };
    let _ = app.emit(EVENT_SETTINGS, &settings);
    Ok(settings)
}

/// Add or replace a named secret (`{{secret.<name>}}`); the value goes to the
/// credential store and is never sent back to the interface.
#[tauri::command]
pub async fn set_secret(name: String, value: String, app: AppHandle, state: State<'_, AppState>) -> CmdResult<Settings> {
    let settings = {
        let mut st = state.settings.lock();
        st.set_user_secret(&name, &value)?;
        st.settings.clone()
    };
    let _ = app.emit(EVENT_SETTINGS, &settings);
    Ok(settings)
}

#[tauri::command]
pub async fn delete_secret(name: String, app: AppHandle, state: State<'_, AppState>) -> CmdResult<Settings> {
    let settings = {
        let mut st = state.settings.lock();
        st.remove_user_secret(&name)?;
        st.settings.clone()
    };
    let _ = app.emit(EVENT_SETTINGS, &settings);
    Ok(settings)
}
