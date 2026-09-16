//! Hub commands: signing in, the inbox, and turning a delivery into pages and
//! buttons after the user has reviewed it.

use super::profile::{apply_import, check_export_format, mutate, with_export_meta, ImportMode, ImportReview};
use super::{err, AppState, CmdResult};
use crate::hub::{BackupInfo, Delivery, HubState, ShareResult, SharedItem};
use crate::profile::legacy::ImportReport;
use crate::profile::store::ProfileError;
use crate::profile::{Button, Page, PlacedButton, Profile};
use serde::Deserialize;
use tauri::{AppHandle, State};

/// Where a delivery goes: a button onto a pad, a page next to the others, a
/// whole configuration added or replacing everything.
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ApplyTarget {
    #[serde(rename_all = "camelCase")]
    Button {
        page_id: String,
        x: u8,
        y: u8,
    },
    Page,
    Profile {
        mode: ImportMode,
    },
}

/// The pages a delivery holds, in the shape the reviewer reads.
fn pages_of(delivery: &Delivery, target: Option<&ApplyTarget>) -> Result<Vec<Page>, String> {
    check_export_format(&delivery.content)?;
    match delivery.kind.as_str() {
        "page" => serde_json::from_value::<Page>(delivery.content.clone()).map(|p| vec![p]).map_err(|e| format!("the page could not be read: {e}")),
        "profile" => serde_json::from_value::<Profile>(delivery.content.clone()).map(|p| p.pages).map_err(|e| format!("the configuration could not be read: {e}")),
        "button" => {
            let button: Button = serde_json::from_value(delivery.content.clone()).map_err(|e| format!("the button could not be read: {e}"))?;
            let (x, y) = match target {
                Some(ApplyTarget::Button { x, y, .. }) => (*x, *y),
                _ => (0, 0),
            };
            Ok(vec![Page { id: "hub".into(), name: delivery.title.clone(), buttons: vec![PlacedButton { x, y, button }], faders: Vec::new() }])
        }
        other => Err(format!("unknown kind of delivery: {other}")),
    }
}

fn counts(pages: &[Page]) -> (usize, usize) {
    let buttons = pages.iter().map(|p| p.buttons.len()).sum();
    let actions = pages
        .iter()
        .flat_map(|p| p.buttons.iter().map(|b| b.button.down.len() + b.button.up.len() + b.button.hold.len()).chain(p.faders.iter().map(|f| f.on_change.len() + f.on_touch.len() + f.on_release.len())))
        .sum();
    (buttons, actions)
}

/// What to share: one button of a page, or a whole page.
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ShareTarget {
    #[serde(rename_all = "camelCase")]
    Button {
        page_id: String,
        x: u8,
        y: u8,
    },
    #[serde(rename_all = "camelCase")]
    Page {
        page_id: String,
    },
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShareRequest {
    pub target: ShareTarget,
    pub title: String,
    #[serde(default)]
    pub summary: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub tags: Vec<String>,
    /// `public` or `unlisted`
    #[serde(default)]
    pub visibility: Option<String>,
    /// The hub's model id of the connected Launchpad, when known
    #[serde(default)]
    pub model: Option<String>,
}

/// The content of a share target as the hub receives it, with its kind. Pictures
/// on buttons are embedded and shrunk on the way out.
fn content_of(state: &AppState, target: &ShareTarget) -> CmdResult<(&'static str, serde_json::Value)> {
    let (kind, mut value) = {
        let store = state.profile.lock();
        match target {
            ShareTarget::Button { page_id, x, y } => {
                let page = store.profile.page(page_id).ok_or_else(|| format!("page {page_id} not found"))?;
                let button = page.get(*x, *y).ok_or_else(|| "there is no button on that pad; share it again from where it is now".to_string())?;
                ("button", serde_json::to_value(button).map_err(err)?)
            }
            ShareTarget::Page { page_id } => {
                let page = store.profile.page(page_id).ok_or_else(|| format!("page {page_id} not found"))?;
                ("page", serde_json::to_value(page).map_err(err)?)
            }
        }
    };
    crate::profile::images::embed_looks(&mut value)?;
    Ok((kind, with_export_meta(value)))
}

fn shared_item(target: &ShareTarget, result: &ShareResult, kind: &str) -> SharedItem {
    let (page_id, x, y) = match target {
        ShareTarget::Button { page_id, x, y } => (page_id.clone(), Some(*x), Some(*y)),
        ShareTarget::Page { page_id } => (page_id.clone(), None, None),
    };
    SharedItem {
        listing_id: result.id.clone(),
        kind: kind.to_string(),
        title: result.title.clone(),
        url: result.url.clone(),
        share_url: result.share_url.clone(),
        page_id,
        x,
        y,
        status: result.status.clone(),
        shared_at: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0),
    }
}

/// Share a button or a page on the hub with this account.
#[tauri::command]
pub async fn hub_share(request: ShareRequest, state: State<'_, AppState>) -> CmdResult<ShareResult> {
    let (kind, content) = content_of(&state, &request.target)?;
    let body = serde_json::json!({
        "kind": kind,
        "title": request.title,
        "summary": request.summary,
        "description": request.description,
        "tags": request.tags,
        "visibility": request.visibility.unwrap_or_else(|| "public".into()),
        "model": request.model,
        "content": content,
    });
    let result = state.hub.share(body).await?;
    state.hub.remember_shared(shared_item(&request.target, &result, kind));
    Ok(result)
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRequest {
    pub listing_id: String,
    pub target: ShareTarget,
    #[serde(default)]
    pub changelog: String,
}

/// Publish a new version of something shared from this app, from where it is now.
#[tauri::command]
pub async fn hub_update_listing(request: UpdateRequest, state: State<'_, AppState>) -> CmdResult<ShareResult> {
    let (kind, content) = content_of(&state, &request.target)?;
    let body = serde_json::json!({ "content": content, "changelog": request.changelog });
    let result = state.hub.update_listing(&request.listing_id, body).await?;
    state.hub.remember_shared(shared_item(&request.target, &result, kind));
    Ok(result)
}

/// Bring the list of shared things in step with the hub.
#[tauri::command]
pub async fn hub_sync_shared(state: State<'_, AppState>) -> CmdResult<HubState> {
    state.hub.sync_shared().await
}

#[tauri::command]
pub async fn hub_forget_shared(listing_id: String, state: State<'_, AppState>) -> CmdResult<HubState> {
    Ok(state.hub.forget_shared(&listing_id))
}

/// Store the whole profile on the hub as a private backup.
#[tauri::command]
pub async fn hub_backup_now(name: String, model: Option<String>, state: State<'_, AppState>) -> CmdResult<BackupInfo> {
    let content = {
        let store = state.profile.lock();
        with_export_meta(serde_json::to_value(&store.profile).map_err(err)?)
    };
    state.hub.backup(&name, model.as_deref(), content).await
}

#[tauri::command]
pub async fn hub_list_backups(state: State<'_, AppState>) -> CmdResult<Vec<BackupInfo>> {
    state.hub.list_backups().await
}

#[tauri::command]
pub async fn hub_delete_backup(id: String, state: State<'_, AppState>) -> CmdResult<Vec<BackupInfo>> {
    state.hub.delete_backup(&id).await
}

/// Put a backup into the inbox; restoring goes through the review like an import.
#[tauri::command]
pub async fn hub_restore_backup(id: String, state: State<'_, AppState>) -> CmdResult<HubState> {
    state.hub.fetch_backup(&id).await
}

#[tauri::command]
pub async fn hub_state(state: State<'_, AppState>) -> CmdResult<HubState> {
    Ok(state.hub.state())
}

#[tauri::command]
pub async fn hub_link_start(state: State<'_, AppState>) -> CmdResult<HubState> {
    state.hub.start_link().await
}

#[tauri::command]
pub async fn hub_link_cancel(state: State<'_, AppState>) -> CmdResult<HubState> {
    Ok(state.hub.cancel_link())
}

#[tauri::command]
pub async fn hub_sign_out(state: State<'_, AppState>) -> CmdResult<HubState> {
    Ok(state.hub.sign_out().await)
}

#[tauri::command]
pub async fn hub_set_url(url: String, state: State<'_, AppState>) -> CmdResult<HubState> {
    state.hub.set_url(&url)
}

#[tauri::command]
pub async fn hub_fetch_listing(reference: String, state: State<'_, AppState>) -> CmdResult<HubState> {
    state.hub.fetch_listing(&reference).await
}

#[tauri::command]
pub async fn hub_dismiss_delivery(id: String, state: State<'_, AppState>) -> CmdResult<HubState> {
    Ok(state.hub.settle(&id, false))
}

/// What a delivery would bring, looked over like a file import; nothing is applied.
#[tauri::command]
pub async fn hub_review_delivery(id: String, target: Option<ApplyTarget>, state: State<'_, AppState>) -> CmdResult<ImportReview> {
    let delivery = state.hub.delivery(&id).ok_or_else(|| "that delivery is gone".to_string())?;
    let pages = pages_of(&delivery, target.as_ref())?;
    let (buttons, actions) = counts(&pages);
    let findings = crate::profile::review::review(&pages);
    Ok(ImportReview { pages: pages.len(), buttons, actions, findings, content: pages })
}

/// Put a reviewed delivery into the profile and tell the hub it was applied.
#[tauri::command]
pub async fn hub_apply_delivery(id: String, target: ApplyTarget, app: AppHandle, state: State<'_, AppState>) -> CmdResult<ImportReport> {
    let delivery = state.hub.delivery(&id).ok_or_else(|| "that delivery is gone".to_string())?;
    let pages = pages_of(&delivery, Some(&target))?;
    let (buttons, actions) = counts(&pages);
    let page_count = pages.len();
    match (&target, delivery.kind.as_str()) {
        (ApplyTarget::Button { page_id, x, y }, "button") => {
            let button = pages.into_iter().next().and_then(|p| p.buttons.into_iter().next()).map(|b| b.button).ok_or_else(|| "the button is empty".to_string())?;
            let (page_id, x, y) = (page_id.clone(), *x, *y);
            mutate(&app, &state, true, move |p| {
                let page = p.page_mut(&page_id).ok_or_else(|| ProfileError::PageNotFound(page_id.clone()))?;
                if page.fader_at(x, y).is_some() {
                    return Err(ProfileError::Invalid("that pad belongs to a fader".into()));
                }
                page.set(x, y, button);
                Ok(())
            })?;
        }
        (ApplyTarget::Page, "page") => {
            let mut page = pages.into_iter().next().ok_or_else(|| "the page is empty".to_string())?;
            page.id = uuid::Uuid::new_v4().to_string();
            if page.name.trim().is_empty() {
                page.name = delivery.title.clone();
            }
            mutate(&app, &state, true, move |p| {
                p.pages.push(page);
                Ok(())
            })?;
        }
        (ApplyTarget::Profile { mode }, "profile") => {
            let mode = *mode;
            mutate(&app, &state, true, move |p| {
                apply_import(p, pages, mode);
                Ok(())
            })?;
        }
        _ => return Err("that target does not fit this delivery".into()),
    }
    state.hub.settle(&id, true);
    Ok(ImportReport { pages: page_count, buttons, actions, warnings: Vec::new() })
}
