//! Page / button commands. Every mutation saves `profile.json`, emits
//! `profile:changed` with the whole profile and repaints the device.

use super::{err, AppState, CmdResult};
use crate::profile::legacy::{import_legacy, ImportReport};
use crate::profile::store::ProfileError;
use crate::profile::*;
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::{AppHandle, Emitter, State};

pub const EVENT_PROFILE: &str = "profile:changed";

/// Run `f` on the profile, then persist, broadcast and repaint.
const UNDO_DEPTH: usize = 30;
pub const EVENT_HISTORY: &str = "history:changed";

/// How many steps can be undone and redone; sent with `history:changed`.
#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryState {
    pub undo: usize,
    pub redo: usize,
}

fn history_snapshot(state: &AppState) -> HistoryState {
    HistoryState { undo: state.history.lock().len(), redo: state.redo.lock().len() }
}

fn emit_history(app: &AppHandle, state: &AppState) {
    let _ = app.emit(EVENT_HISTORY, history_snapshot(state));
}

/// Apply an edit from the UI. With `record`, the profile before the edit goes
/// on the undo stack and the redo stack is dropped (page switches are not recorded).
fn mutate<T>(app: &AppHandle, state: &AppState, record: bool, f: impl FnOnce(&mut Profile) -> Result<T, ProfileError>) -> CmdResult<T> {
    let before = if record { Some(state.profile.lock().profile.clone()) } else { None };
    let (result, profile) = crate::profile::mutate(&state.profile, f).map_err(err)?;
    if let Some(before) = before {
        let mut history = state.history.lock();
        history.push(before);
        if history.len() > UNDO_DEPTH {
            history.remove(0);
        }
        state.redo.lock().clear();
        drop(history);
        emit_history(app, state);
    }
    let _ = app.emit(EVENT_PROFILE, &profile);
    state.manager.lock().request_repaint();
    Ok(result)
}

/// Put back the profile as it was before the last recorded edit. Returns
/// false when there is nothing to undo.
#[tauri::command]
pub async fn undo_profile(app: AppHandle, state: State<'_, AppState>) -> CmdResult<bool> {
    let Some(previous) = state.history.lock().pop() else { return Ok(false) };
    let current = state.profile.lock().profile.clone();
    mutate(&app, &state, false, |p| {
        *p = previous;
        Ok(())
    })?;
    state.redo.lock().push(current);
    emit_history(&app, &state);
    Ok(true)
}

/// Re-apply the last undone edit. Returns false when there is nothing to redo.
#[tauri::command]
pub async fn redo_profile(app: AppHandle, state: State<'_, AppState>) -> CmdResult<bool> {
    let Some(next) = state.redo.lock().pop() else { return Ok(false) };
    let current = state.profile.lock().profile.clone();
    mutate(&app, &state, false, |p| {
        *p = next;
        Ok(())
    })?;
    {
        let mut history = state.history.lock();
        history.push(current);
        if history.len() > UNDO_DEPTH {
            history.remove(0);
        }
    }
    emit_history(&app, &state);
    Ok(true)
}

#[tauri::command]
pub async fn history_state(state: State<'_, AppState>) -> CmdResult<HistoryState> {
    Ok(history_snapshot(&state))
}

/// Sound files referenced by any action that no longer exist on disk.
#[tauri::command]
pub async fn missing_sound_files(state: State<'_, AppState>) -> CmdResult<Vec<String>> {
    let files: Vec<String> = {
        let store = state.profile.lock();
        let mut files: Vec<String> = Vec::new();
        for page in &store.profile.pages {
            let actions = page.buttons.iter().flat_map(|b| b.button.down.iter().chain(b.button.up.iter()).chain(b.button.hold.iter())).chain(page.faders.iter().flat_map(|f| f.on_change.iter()));
            for action in actions {
                if let crate::macros::ActionKind::PlaySound { file, .. } = &action.kind {
                    if !file.trim().is_empty() && !files.contains(file) {
                        files.push(file.clone());
                    }
                }
            }
        }
        files
    };
    tauri::async_runtime::spawn_blocking(move || files.into_iter().filter(|f| !std::path::Path::new(f).exists()).collect::<Vec<_>>()).await.map_err(err)
}

#[tauri::command]
pub async fn get_profile(state: State<'_, AppState>) -> CmdResult<Profile> {
    Ok(state.profile.lock().profile.clone())
}

#[tauri::command]
pub async fn set_active_page(page_id: String, app: AppHandle, state: State<'_, AppState>) -> CmdResult<()> {
    mutate(&app, &state, false, |p| {
        p.page(&page_id).ok_or_else(|| ProfileError::PageNotFound(page_id.clone()))?;
        p.active_page = page_id.clone();
        Ok(())
    })
}

#[tauri::command]
pub async fn add_page(name: String, app: AppHandle, state: State<'_, AppState>) -> CmdResult<Page> {
    mutate(&app, &state, true, |p| {
        let name = if name.trim().is_empty() { format!("Page {}", p.pages.len() + 1) } else { name.trim().to_string() };
        let page = Page::with_new_id(name);
        p.pages.push(page.clone());
        Ok(page)
    })
}

#[tauri::command]
pub async fn rename_page(page_id: String, name: String, app: AppHandle, state: State<'_, AppState>) -> CmdResult<()> {
    mutate(&app, &state, true, |p| {
        let page = p.page_mut(&page_id).ok_or_else(|| ProfileError::PageNotFound(page_id.clone()))?;
        if name.trim().is_empty() {
            return Err(ProfileError::Invalid("page name cannot be empty".into()));
        }
        page.name = name.trim().to_string();
        Ok(())
    })
}

#[tauri::command]
pub async fn remove_page(page_id: String, app: AppHandle, state: State<'_, AppState>) -> CmdResult<()> {
    mutate(&app, &state, true, |p| {
        if page_id == DEFAULT_PAGE_ID {
            return Err(ProfileError::DefaultPage);
        }
        let idx = p.pages.iter().position(|pg| pg.id == page_id).ok_or_else(|| ProfileError::PageNotFound(page_id.clone()))?;
        p.pages.remove(idx);
        if p.active_page == page_id {
            p.active_page = p.pages.first().map(|pg| pg.id.clone()).unwrap_or_else(|| DEFAULT_PAGE_ID.into());
        }
        Ok(())
    })
}

#[tauri::command]
pub async fn duplicate_page(page_id: String, app: AppHandle, state: State<'_, AppState>) -> CmdResult<Page> {
    mutate(&app, &state, true, |p| {
        let src = p.page(&page_id).ok_or_else(|| ProfileError::PageNotFound(page_id.clone()))?;
        let mut copy = src.clone();
        copy.id = uuid::Uuid::new_v4().to_string();
        copy.name = format!("{} copy", src.name);
        p.pages.push(copy.clone());
        Ok(copy)
    })
}

#[tauri::command]
pub async fn move_page(page_id: String, to_index: usize, app: AppHandle, state: State<'_, AppState>) -> CmdResult<()> {
    mutate(&app, &state, true, |p| {
        let idx = p.pages.iter().position(|pg| pg.id == page_id).ok_or_else(|| ProfileError::PageNotFound(page_id.clone()))?;
        let page = p.pages.remove(idx);
        let to = to_index.min(p.pages.len());
        p.pages.insert(to, page);
        Ok(())
    })
}

#[tauri::command]
pub async fn set_button(page_id: String, x: u8, y: u8, button: Button, app: AppHandle, state: State<'_, AppState>) -> CmdResult<()> {
    mutate(&app, &state, true, |p| {
        let page = p.page_mut(&page_id).ok_or_else(|| ProfileError::PageNotFound(page_id.clone()))?;
        page.set(x, y, button);
        Ok(())
    })
}

/// Insert or replace a fader on a page.
#[tauri::command]
pub async fn set_fader(page_id: String, fader: crate::profile::Fader, app: AppHandle, state: State<'_, AppState>) -> CmdResult<()> {
    mutate(&app, &state, true, |p| {
        let page = p.page_mut(&page_id).ok_or_else(|| ProfileError::PageNotFound(page_id.clone()))?;
        if fader.length < 2 {
            return Err(ProfileError::Invalid("a fader needs at least two pads".into()));
        }
        let mut fader = fader;
        if fader.id.is_empty() {
            fader.id = uuid::Uuid::new_v4().to_string();
        }
        // Keep the level inside the new range.
        let (lo, hi) = if fader.min <= fader.max { (fader.min, fader.max) } else { (fader.max, fader.min) };
        fader.value = fader.value.clamp(lo, hi);
        page.set_fader(fader);
        Ok(())
    })
}

/// Move a fader so its first pad sits at (x, y). Refused when the new pads
/// would cover a button or another fader; the UI checks the grid edges.
#[tauri::command]
pub async fn move_fader(page_id: String, fader_id: String, x: u8, y: u8, app: AppHandle, state: State<'_, AppState>) -> CmdResult<()> {
    mutate(&app, &state, true, |p| {
        let page = p.page_mut(&page_id).ok_or_else(|| ProfileError::PageNotFound(page_id.clone()))?;
        let mut moved = page.faders.iter().find(|f| f.id == fader_id).cloned().ok_or_else(|| ProfileError::Invalid(format!("no fader {fader_id}")))?;
        moved.x = x;
        moved.y = y;
        let pads = moved.pads();
        if pads.len() < moved.steps() {
            return Err(ProfileError::Invalid("the fader does not fit there".into()));
        }
        if pads.iter().any(|(px, py)| page.get(*px, *py).is_some()) {
            return Err(ProfileError::Invalid("a button is in the way".into()));
        }
        if page.faders.iter().filter(|f| f.id != fader_id).any(|f| f.pads().iter().any(|p| pads.contains(p))) {
            return Err(ProfileError::Invalid("another fader is in the way".into()));
        }
        page.set_fader(moved);
        Ok(())
    })
}

#[tauri::command]
pub async fn remove_fader(page_id: String, fader_id: String, app: AppHandle, state: State<'_, AppState>) -> CmdResult<()> {
    mutate(&app, &state, true, |p| {
        let page = p.page_mut(&page_id).ok_or_else(|| ProfileError::PageNotFound(page_id.clone()))?;
        page.remove_fader(&fader_id);
        Ok(())
    })
}

#[tauri::command]
pub async fn clear_button(page_id: String, x: u8, y: u8, app: AppHandle, state: State<'_, AppState>) -> CmdResult<()> {
    mutate(&app, &state, true, |p| {
        let page = p.page_mut(&page_id).ok_or_else(|| ProfileError::PageNotFound(page_id.clone()))?;
        page.remove(x, y);
        Ok(())
    })
}

#[derive(Debug, Clone, Copy, Deserialize)]
pub struct Coord {
    pub x: u8,
    pub y: u8,
}

/// Move (or copy) a button to another pad on the same page. Moving onto an
/// occupied pad swaps the two; copying onto one overwrites it.
#[tauri::command]
pub async fn move_button(page_id: String, from: Coord, to: Coord, copy: bool, app: AppHandle, state: State<'_, AppState>) -> CmdResult<()> {
    mutate(&app, &state, true, |p| {
        let page = p.page_mut(&page_id).ok_or_else(|| ProfileError::PageNotFound(page_id.clone()))?;
        if (from.x, from.y) == (to.x, to.y) {
            return Ok(());
        }
        if copy {
            if let Some(button) = page.get(from.x, from.y).cloned() {
                page.set(to.x, to.y, button);
            }
        } else {
            page.swap((from.x, from.y), (to.x, to.y));
        }
        Ok(())
    })
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ImportMode {
    /// Add the imported pages next to the existing ones
    Append,
    /// Replace every page
    Replace,
}

fn apply_import(p: &mut Profile, mut pages: Vec<Page>, mode: ImportMode) {
    match mode {
        ImportMode::Replace => {
            p.pages = pages;
            p.active_page = p.pages.first().map(|pg| pg.id.clone()).unwrap_or_default();
        }
        ImportMode::Append => {
            for page in pages.iter_mut() {
                if p.page(&page.id).is_some() {
                    page.id = uuid::Uuid::new_v4().to_string();
                }
                if page.name == "default" && page.id != DEFAULT_PAGE_ID {
                    page.name = "Imported".into();
                }
            }
            p.pages.extend(pages);
        }
    }
    p.normalize();
}

/// Import a legacy Lunchpad configuration (the `layout.config` JSON or a
/// single exported page).
#[tauri::command]
pub async fn import_legacy_json(json: String, mode: ImportMode, app: AppHandle, state: State<'_, AppState>) -> CmdResult<ImportReport> {
    let (pages, report) = import_legacy(&json)?;
    mutate(&app, &state, true, |p| {
        apply_import(p, pages, mode);
        Ok(report)
    })
}

#[tauri::command]
pub async fn import_legacy_file(path: String, mode: ImportMode, app: AppHandle, state: State<'_, AppState>) -> CmdResult<ImportReport> {
    let json = std::fs::read_to_string(&path).map_err(|e| format!("could not read {path}: {e}"))?;
    import_legacy_json(json, mode, app, state).await
}

/// Export one page as JSON (new format).
#[tauri::command]
pub async fn export_page(page_id: String, state: State<'_, AppState>) -> CmdResult<String> {
    let store = state.profile.lock();
    let page = store.profile.page(&page_id).ok_or_else(|| format!("page {page_id} not found"))?;
    serde_json::to_string_pretty(page).map_err(err)
}

/// Import a page exported by this app (new format) or by the legacy app.
#[tauri::command]
pub async fn import_page_json(json: String, app: AppHandle, state: State<'_, AppState>) -> CmdResult<ImportReport> {
    if let Ok(mut page) = serde_json::from_str::<Page>(&json) {
        if page.buttons.iter().all(|b| b.button.look != Look::Text { caption: "".into(), size: 0, face: "".into(), color: "".into() }) {
            let buttons = page.buttons.len();
            let actions = page.buttons.iter().map(|b| b.button.down.len() + b.button.up.len()).sum();
            page.id = uuid::Uuid::new_v4().to_string();
            return mutate(&app, &state, true, |p| {
                p.pages.push(page);
                Ok(ImportReport { pages: 1, buttons, actions, warnings: vec![] })
            });
        }
    }
    import_legacy_json(json, ImportMode::Append, app, state).await
}

/// Write a page export to a file chosen by the user.
#[tauri::command]
pub async fn export_page_file(page_id: String, path: String, state: State<'_, AppState>) -> CmdResult<()> {
    let json = export_page(page_id, state).await?;
    std::fs::write(&path, json).map_err(|e| format!("could not write {path}: {e}"))
}

#[tauri::command]
pub async fn import_page_file(path: String, app: AppHandle, state: State<'_, AppState>) -> CmdResult<ImportReport> {
    let json = std::fs::read_to_string(&path).map_err(|e| format!("could not read {path}: {e}"))?;
    import_page_json(json, app, state).await
}

#[tauri::command]
pub async fn restore_profile_backup(app: AppHandle, state: State<'_, AppState>) -> CmdResult<Profile> {
    let profile = {
        let mut store = state.profile.lock();
        store.restore_backup().map_err(err)?;
        let _ = app.emit(EVENT_PROFILE, &store.profile);
        store.profile.clone()
    };
    state.manager.lock().request_repaint();
    Ok(profile)
}

/// Read an image file and return it as a `data:` URI for a button look.
#[tauri::command]
pub async fn read_image_data_uri(path: String) -> CmdResult<String> {
    let p = Path::new(&path);
    let mime = match p.extension().and_then(|e| e.to_str()).map(|e| e.to_ascii_lowercase()).as_deref() {
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("svg") => "image/svg+xml",
        Some("bmp") => "image/bmp",
        _ => return Err("unsupported image type (use png, jpg, gif, webp, svg or bmp)".into()),
    };
    let bytes = std::fs::read(p).map_err(|e| format!("could not read image: {e}"))?;
    if bytes.len() > 2 * 1024 * 1024 {
        return Err("image is larger than 2 MB; please use a smaller file".into());
    }
    Ok(format!("data:{mime};base64,{}", base64::engine::general_purpose::STANDARD.encode(bytes)))
}
