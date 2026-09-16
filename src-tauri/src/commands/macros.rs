//! Macro engine commands.

use super::{AppState, CmdResult};
use crate::macros::{ActionList, ButtonTrigger, RunningMacro};
use tauri::State;

/// The provided variables that never change while the app runs (the app, the
/// machine, the folders), for the interface to fill descriptions with.
#[tauri::command]
pub async fn builtin_info(state: State<'_, AppState>) -> CmdResult<std::collections::HashMap<String, String>> {
    Ok(crate::macros::builtins::info(&state.engine.env()).into_iter().map(|(k, v)| (k.to_string(), v)).collect())
}

#[tauri::command]
pub async fn get_running_macros(state: State<'_, AppState>) -> CmdResult<Vec<RunningMacro>> {
    Ok(state.engine.running())
}

#[tauri::command]
pub async fn stop_all_macros(state: State<'_, AppState>) -> CmdResult<()> {
    state.engine.stop_all();
    Ok(())
}

#[tauri::command]
pub async fn stop_macros_at(page_id: String, x: u8, y: u8, state: State<'_, AppState>) -> CmdResult<()> {
    state.engine.stop_at(&page_id, x, y);
    Ok(())
}

/// Run a button from the UI ("test" in the editor). `velocity` defaults to full.
#[tauri::command]
pub async fn run_button(page_id: String, x: u8, y: u8, trigger: ButtonTrigger, velocity: Option<u8>, state: State<'_, AppState>) -> CmdResult<bool> {
    let velocity = velocity.unwrap_or(127).clamp(1, 127);
    let lists: &[ActionList] = match trigger {
        ButtonTrigger::Press => &[ActionList::Down],
        ButtonTrigger::Release => &[ActionList::Up],
        ButtonTrigger::Tap => &[ActionList::Down, ActionList::Up],
        ButtonTrigger::Hold => &[ActionList::Hold],
    };
    let mut started = false;
    for list in lists {
        started |= state.engine.start(&page_id, x, y, *list, velocity, 0, None).is_some();
    }
    Ok(started)
}
