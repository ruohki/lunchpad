//! Macro engine commands.

use super::{AppState, CmdResult};
use crate::macros::{ActionList, ButtonTrigger, RunningMacro};
use tauri::State;

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
