//! Tray icon and its menu, mirroring the legacy app: Discord link, show the
//! window, stay on top, minimize to tray, run at startup, stop all macros,
//! quit. The check items and `WindowSettings` are kept in sync both ways, and
//! closing the window hides it while "minimize to tray" is on.
//!
//! Labels default to English; the UI sends translated ones through
//! `set_tray_labels` once i18n is ready.

use crate::commands::{AppState, EVENT_SETTINGS};
use crate::config::WindowSettings;
use serde::Deserialize;
use tauri::menu::{CheckMenuItem, IconMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, Wry};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_opener::OpenerExt;

pub const DISCORD_URL: &str = "https://discord.gg/4Ys9TRR";
pub const MAIN_WINDOW: &str = "main";

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayLabels {
    pub discord: String,
    pub show: String,
    pub stay_on_top: String,
    pub minimize_to_tray: String,
    pub run_at_startup: String,
    pub stop_all: String,
    pub quit: String,
}

impl Default for TrayLabels {
    fn default() -> Self {
        TrayLabels {
            discord: "Join the Discord!".into(),
            show: "Show Lunchpad".into(),
            stay_on_top: "Stay on top".into(),
            minimize_to_tray: "Minimize to tray".into(),
            run_at_startup: "Run at startup".into(),
            stop_all: "Stop all running macros".into(),
            quit: "Quit".into(),
        }
    }
}

/// Menu item handles, managed as Tauri state so settings changes update the checks.
pub struct TrayItems {
    discord: IconMenuItem<Wry>,
    show: MenuItem<Wry>,
    stay_on_top: CheckMenuItem<Wry>,
    minimize_to_tray: CheckMenuItem<Wry>,
    run_at_startup: CheckMenuItem<Wry>,
    stop_all: MenuItem<Wry>,
    quit: MenuItem<Wry>,
}

pub fn setup(app: &AppHandle, settings: &WindowSettings) -> tauri::Result<()> {
    let l = TrayLabels::default();
    let items = TrayItems {
        // The Discord entry carries the Discord logo like the legacy app's tray menu did
        // (menu item icons work on Windows, macOS and Linux; check items cannot have one).
        discord: IconMenuItem::with_id(app, "discord", &l.discord, true, discord_icon(), None::<&str>)?,
        show: MenuItem::with_id(app, "show", &l.show, true, None::<&str>)?,
        stay_on_top: CheckMenuItem::with_id(app, "stay_on_top", &l.stay_on_top, true, settings.stay_on_top, None::<&str>)?,
        minimize_to_tray: CheckMenuItem::with_id(app, "minimize_to_tray", &l.minimize_to_tray, true, settings.minimize_to_tray, None::<&str>)?,
        run_at_startup: CheckMenuItem::with_id(app, "run_at_startup", &l.run_at_startup, true, settings.run_at_startup, None::<&str>)?,
        stop_all: MenuItem::with_id(app, "stop_all", &l.stop_all, true, None::<&str>)?,
        quit: MenuItem::with_id(app, "quit", &l.quit, true, None::<&str>)?,
    };
    let menu = Menu::with_items(
        app,
        &[
            &items.discord,
            &PredefinedMenuItem::separator(app)?,
            &items.show,
            &items.stay_on_top,
            &items.minimize_to_tray,
            &items.run_at_startup,
            &PredefinedMenuItem::separator(app)?,
            &items.stop_all,
            &PredefinedMenuItem::separator(app)?,
            &items.quit,
        ],
    )?;
    let mut builder = TrayIconBuilder::with_id("main").tooltip("Lunchpad").menu(&menu).show_menu_on_left_click(true).on_menu_event(|app, event| on_menu(app, event.id().as_ref()));
    // macOS menu bars want a monochrome template image; Windows shows the coloured logo.
    #[cfg(target_os = "macos")]
    match tauri::image::Image::from_bytes(include_bytes!("../icons/tray-template@2x.png")) {
        Ok(icon) => builder = builder.icon(icon).icon_as_template(true),
        Err(e) => {
            tracing::warn!(error = %e, "tray template icon unreadable");
            if let Some(icon) = app.default_window_icon().cloned() {
                builder = builder.icon(icon);
            }
        }
    }
    #[cfg(not(target_os = "macos"))]
    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }
    builder.build(app)?;
    app.manage(items);
    apply(app, settings);
    Ok(())
}

fn discord_icon() -> Option<tauri::image::Image<'static>> {
    match tauri::image::Image::from_bytes(include_bytes!("../icons/tray-discord.png")) {
        Ok(icon) => Some(icon),
        Err(e) => {
            tracing::warn!(error = %e, "tray Discord icon unreadable");
            None
        }
    }
}

/// Push `settings` to the window, the OS autostart entry and the tray checks.
pub fn apply(app: &AppHandle, settings: &WindowSettings) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        if let Err(e) = window.set_always_on_top(settings.stay_on_top) {
            tracing::warn!(error = %e, "could not change stay on top");
        }
    }
    let launcher = app.autolaunch();
    let result = if settings.run_at_startup { launcher.enable() } else { launcher.disable() };
    if let Err(e) = result {
        tracing::warn!(error = %e, enable = settings.run_at_startup, "could not update run at startup");
    }
    if let Some(items) = app.try_state::<TrayItems>() {
        let _ = items.stay_on_top.set_checked(settings.stay_on_top);
        let _ = items.minimize_to_tray.set_checked(settings.minimize_to_tray);
        let _ = items.run_at_startup.set_checked(settings.run_at_startup);
    }
}

pub fn set_labels(app: &AppHandle, labels: &TrayLabels) {
    let Some(items) = app.try_state::<TrayItems>() else { return };
    let _ = items.discord.set_text(&labels.discord);
    let _ = items.show.set_text(&labels.show);
    let _ = items.stay_on_top.set_text(&labels.stay_on_top);
    let _ = items.minimize_to_tray.set_text(&labels.minimize_to_tray);
    let _ = items.run_at_startup.set_text(&labels.run_at_startup);
    let _ = items.stop_all.set_text(&labels.stop_all);
    let _ = items.quit.set_text(&labels.quit);
}

pub fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// True when closing the window should hide it instead.
pub fn hides_on_close(app: &AppHandle) -> bool {
    app.try_state::<AppState>().map(|s| s.settings.lock().settings.window.minimize_to_tray).unwrap_or(false)
}

fn update_settings(app: &AppHandle, f: impl FnOnce(&mut WindowSettings)) {
    let Some(state) = app.try_state::<AppState>() else { return };
    let settings = {
        let mut st = state.settings.lock();
        f(&mut st.settings.window);
        if let Err(e) = st.save() {
            tracing::warn!(error = %e, "settings could not be saved");
        }
        st.settings.clone()
    };
    apply(app, &settings.window);
    let _ = app.emit(EVENT_SETTINGS, &settings);
}

fn on_menu(app: &AppHandle, id: &str) {
    let items = app.try_state::<TrayItems>();
    let checked = |item: &CheckMenuItem<Wry>| item.is_checked().unwrap_or(false);
    match id {
        "discord" => {
            if let Err(e) = app.opener().open_url(DISCORD_URL, None::<&str>) {
                tracing::warn!(error = %e, "could not open the Discord link");
            }
        }
        "show" => show_main(app),
        "stay_on_top" => {
            let on = items.as_ref().map(|i| checked(&i.stay_on_top)).unwrap_or(false);
            update_settings(app, |w| w.stay_on_top = on);
        }
        "minimize_to_tray" => {
            let on = items.as_ref().map(|i| checked(&i.minimize_to_tray)).unwrap_or(false);
            update_settings(app, |w| w.minimize_to_tray = on);
        }
        "run_at_startup" => {
            let on = items.as_ref().map(|i| checked(&i.run_at_startup)).unwrap_or(false);
            update_settings(app, |w| w.run_at_startup = on);
        }
        "stop_all" => {
            if let Some(state) = app.try_state::<AppState>() {
                state.engine.stop_all();
            }
        }
        "quit" => app.exit(0),
        other => tracing::debug!(id = other, "unhandled tray item"),
    }
}
