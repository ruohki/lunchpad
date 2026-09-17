//! The debug window asks for its text when it opens.

use super::CmdResult;
use crate::debug::{self, DebugContent};
use tauri::AppHandle;

#[tauri::command]
pub fn debug_text(app: AppHandle, id: String) -> CmdResult<Option<DebugContent>> {
    Ok(debug::content(&app, &id))
}
