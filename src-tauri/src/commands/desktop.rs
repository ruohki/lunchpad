//! Other programs' windows, for the window action's editor.

use super::CmdResult;
use crate::desktop::{self, ScreenInfo, WindowInfo};

/// Every window a user could pick, off the runtime since the system calls block.
#[tauri::command]
pub async fn list_windows() -> CmdResult<Vec<WindowInfo>> {
    tauri::async_runtime::spawn_blocking(desktop::list)
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn foreground_window() -> CmdResult<Option<WindowInfo>> {
    tauri::async_runtime::spawn_blocking(desktop::foreground)
        .await
        .map_err(|e| e.to_string())?
}

/// The displays, for the get-screen editor's note.
#[tauri::command]
pub async fn list_screens() -> CmdResult<Vec<ScreenInfo>> {
    tauri::async_runtime::spawn_blocking(desktop::screens)
        .await
        .map_err(|e| e.to_string())?
}
