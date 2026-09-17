//! Debug windows: the "debug" action opens a small window with a text, one
//! window per action, and running the action again updates that window.

use serde::Serialize;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};

/// What each debug window shows, by action id; the page asks for it when it opens.
#[derive(Default)]
pub struct DebugTexts(Mutex<HashMap<String, DebugContent>>);

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DebugContent {
    pub id: String,
    pub title: String,
    pub text: String,
}

/// The event a debug window listens to for updates.
pub const EVENT: &str = "debug:text";

pub fn label_of(id: &str) -> String {
    format!("debug-{id}")
}

pub fn content(app: &AppHandle, id: &str) -> Option<DebugContent> {
    app.try_state::<DebugTexts>().and_then(|state| state.0.lock().ok().and_then(|map| map.get(id).cloned()))
}

/// Shows the text in the action's window, opening it when it is not there.
pub fn show(app: &AppHandle, id: &str, title: String, text: String, always_on_top: bool) -> Result<(), String> {
    let content = DebugContent { id: id.to_string(), title, text };
    if let Some(state) = app.try_state::<DebugTexts>() {
        if let Ok(mut map) = state.0.lock() {
            map.insert(id.to_string(), content.clone());
        }
    }
    let label = label_of(id);
    if let Some(window) = app.get_webview_window(&label) {
        let _ = window.set_title(&content.title);
        let _ = window.set_always_on_top(always_on_top);
        return app.emit_to(&label, EVENT, &content).map_err(|e| e.to_string());
    }
    let handle = app.clone();
    app.run_on_main_thread(move || {
        let url = tauri::WebviewUrl::App(format!("index.html?debug={}", content.id).into());
        if let Err(e) = tauri::WebviewWindowBuilder::new(&handle, &label, url).title(&content.title).always_on_top(always_on_top).inner_size(520.0, 360.0).min_inner_size(240.0, 120.0).build() {
            tracing::warn!(error = %e, "could not open the debug window");
        }
    })
    .map_err(|e| e.to_string())
}
