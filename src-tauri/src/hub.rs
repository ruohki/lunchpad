//! The community hub (hub.lunchp.ad): signing the app in through the browser,
//! and the inbox of buttons, pages and configurations sent to it from the
//! site. Nothing from the inbox is applied until the user has reviewed it in
//! the same dialog an imported file goes through.
//!
//! The hub token lives in the credential store (`SecretKey::HubToken`); the
//! settings file only keeps the hub address and who is signed in.

use crate::config::SharedSettings;
use crate::secrets::SecretKey;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tauri_plugin_opener::OpenerExt;

pub const EVENT_HUB: &str = "hub:state";
pub const DEFAULT_HUB_URL: &str = "https://hub.lunchp.ad";
/// The protocol this app speaks to the hub; a hub answering with a higher number needs a newer app.
pub const HUB_API_VERSION: u32 = 1;

/// How long one inbox request waits on the server before answering empty. Kept
/// under the 30 s many proxies and CDNs allow an origin to take.
const INBOX_WAIT_SECS: u64 = 20;
/// Pause before trying again after a network error.
const RETRY_SECS: u64 = 15;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HubUser {
    pub id: String,
    pub handle: String,
    pub name: String,
    #[serde(default)]
    pub image: Option<String>,
}

/// Something shared from this app, remembered so it can be updated from the same place.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SharedItem {
    pub listing_id: String,
    /// `button` or `page`
    pub kind: String,
    pub title: String,
    pub url: String,
    pub share_url: String,
    pub page_id: String,
    #[serde(default)]
    pub x: Option<u8>,
    #[serde(default)]
    pub y: Option<u8>,
    /// `published`, `pending`, `rejected` or `hidden`, as last heard from the hub
    #[serde(default)]
    pub status: String,
    #[serde(default)]
    pub shared_at: u64,
}

/// What `settings.json` keeps about the hub.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HubSettings {
    #[serde(default = "default_hub_url")]
    pub url: String,
    /// Who the stored token belongs to; `None` while signed out.
    #[serde(default)]
    pub user: Option<HubUser>,
    /// Buttons and pages shared from this app, for "Update on the hub".
    #[serde(default)]
    pub shared: Vec<SharedItem>,
}

fn default_hub_url() -> String {
    DEFAULT_HUB_URL.into()
}

impl Default for HubSettings {
    fn default() -> Self {
        HubSettings { url: default_hub_url(), user: None, shared: Vec::new() }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum HubStatus {
    SignedOut,
    /// The browser is open; the sign-in there has not finished yet.
    Linking,
    /// Signed in; the first inbox request is on its way.
    Connecting,
    /// Signed in and listening for deliveries.
    Connected,
    /// Signed in, but the hub cannot be reached right now (`error` says why).
    Offline,
}

/// A sign-in in progress: the page the browser was opened with, and until when it is valid.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingLink {
    pub verify_url: String,
    pub expires_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryAuthor {
    pub handle: String,
    pub name: String,
}

/// One thing sent from the site, with its content, waiting in the inbox.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Delivery {
    pub id: String,
    /// `button`, `page` or `profile`
    pub kind: String,
    pub title: String,
    pub listing_id: String,
    pub listing_url: String,
    #[serde(default)]
    pub version_number: u32,
    #[serde(default)]
    pub author: Option<DeliveryAuthor>,
    /// `safe`, `caution` or `danger`, the hub's own verdict; the app reviews again anyway
    #[serde(default)]
    pub risk: String,
    /// The export format of the content (the hub's copy of `lunchpad.format`)
    #[serde(default)]
    pub format_version: Option<u32>,
    /// The Lunchpad that wrote the content, when its export said so
    #[serde(default)]
    pub app_version: Option<String>,
    pub content: serde_json::Value,
    #[serde(default)]
    pub received_at: u64,
    /// Fetched by hand from a link rather than sent from the site (no acknowledgement needed).
    #[serde(default)]
    pub fetched: bool,
}

/// What the hub answers when the app shares something.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShareResult {
    pub id: String,
    pub url: String,
    pub share_url: String,
    /// `published`, `pending` (a moderator looks first) or `rejected`
    pub status: String,
    #[serde(default)]
    pub status_reason: Option<String>,
    pub title: String,
    #[serde(default)]
    pub version_number: u32,
}

/// One of the user's listings as the hub lists them.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MyListing {
    pub id: String,
    pub kind: String,
    pub title: String,
    pub status: String,
    #[serde(default)]
    pub status_reason: Option<String>,
    pub url: String,
    pub share_url: String,
    #[serde(default)]
    pub updated_at: u64,
}

/// A private configuration backup kept on the hub (without its content).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupInfo {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub app_version: Option<String>,
    #[serde(default)]
    pub format_version: u32,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub stats: serde_json::Value,
    #[serde(default)]
    pub bytes: u64,
    pub created_at: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HubState {
    pub url: String,
    pub status: HubStatus,
    pub user: Option<HubUser>,
    pub link: Option<PendingLink>,
    pub error: Option<String>,
    pub inbox: Vec<Delivery>,
    pub shared: Vec<SharedItem>,
}

struct Inner {
    status: HubStatus,
    link: Option<(PendingLink, String)>,
    error: Option<String>,
    inbox: Vec<Delivery>,
    token: Option<String>,
    /// Bumped whenever a loop must stop (sign-out, cancel, a new sign-in).
    generation: u64,
}

#[derive(Clone)]
pub struct HubHandle {
    app: AppHandle,
    settings: SharedSettings,
    client: reqwest::Client,
    inner: Arc<Mutex<Inner>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LinkStartResponse {
    poll_token: String,
    verify_url: String,
    expires_at: u64,
    #[serde(default)]
    interval: Option<u64>,
    #[serde(default)]
    api_version: Option<u32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LinkPollResponse {
    status: String,
    #[serde(default)]
    token: Option<String>,
    #[serde(default)]
    user: Option<HubUser>,
}

#[derive(Debug, Deserialize)]
struct InboxResponse {
    items: Vec<Delivery>,
}

#[derive(Debug, Deserialize)]
struct ApiErrorBody {
    error: ApiErrorInner,
}

#[derive(Debug, Deserialize)]
struct ApiErrorInner {
    message: String,
    #[serde(default)]
    details: Option<serde_json::Value>,
}

fn now_ms() -> u64 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

/// The message inside a hub error answer (with its reasons, when it lists some), or the status line.
async fn error_text(res: reqwest::Response) -> String {
    let status = res.status();
    match res.json::<ApiErrorBody>().await {
        Ok(body) => {
            let reasons: Vec<String> = body
                .error
                .details
                .as_ref()
                .and_then(|d| d.get("reasons"))
                .and_then(|r| r.as_array())
                .map(|r| r.iter().filter_map(|v| v.as_str().map(|s| format!("• {s}"))).collect())
                .unwrap_or_default();
            if reasons.is_empty() {
                body.error.message
            } else {
                format!("{}\n{}", body.error.message, reasons.join("\n"))
            }
        }
        Err(_) => format!("the hub answered {status}"),
    }
}

impl HubHandle {
    /// Set up from the settings; a stored token starts listening right away.
    pub fn spawn(app: AppHandle, settings: SharedSettings) -> HubHandle {
        let client = reqwest::Client::builder().user_agent(format!("Lunchpad/{}", env!("CARGO_PKG_VERSION"))).build().unwrap_or_default();
        let (token, user) = {
            let st = settings.lock();
            let token = st.secrets.get(SecretKey::HubToken);
            (if token.is_empty() { None } else { Some(token) }, st.settings.hub.user.clone())
        };
        let signed_in = token.is_some() && user.is_some();
        let handle = HubHandle {
            app,
            settings,
            client,
            inner: Arc::new(Mutex::new(Inner { status: if signed_in { HubStatus::Connecting } else { HubStatus::SignedOut }, link: None, error: None, inbox: Vec::new(), token, generation: 0 })),
        };
        if signed_in {
            handle.start_inbox_loop();
        }
        handle
    }

    fn url(&self) -> String {
        self.settings.lock().settings.hub.url.trim_end_matches('/').to_string()
    }

    pub fn state(&self) -> HubState {
        let inner = self.inner.lock();
        let st = self.settings.lock();
        HubState {
            url: st.settings.hub.url.clone(),
            status: inner.status,
            user: st.settings.hub.user.clone(),
            link: inner.link.as_ref().map(|(l, _)| l.clone()),
            error: inner.error.clone(),
            inbox: inner.inbox.clone(),
            shared: st.settings.hub.shared.clone(),
        }
    }

    fn emit(&self) {
        let _ = self.app.emit(EVENT_HUB, self.state());
    }

    fn bump(&self) -> u64 {
        let mut inner = self.inner.lock();
        inner.generation += 1;
        inner.generation
    }

    fn stale(&self, generation: u64) -> bool {
        self.inner.lock().generation != generation
    }

    /// Start a sign-in: ask the hub for a session, open the browser on it, and wait for the confirmation.
    pub async fn start_link(&self) -> Result<HubState, String> {
        let url = self.url();
        let name = gethostname::gethostname().to_string_lossy().to_string();
        let body = serde_json::json!({ "name": if name.is_empty() { "Lunchpad".to_string() } else { name }, "platform": std::env::consts::OS, "appVersion": env!("CARGO_PKG_VERSION") });
        let res = self
            .client
            .post(format!("{url}/api/link/start"))
            .header("x-lunchpad-version", env!("CARGO_PKG_VERSION"))
            .header("x-lunchpad-api", HUB_API_VERSION.to_string())
            .json(&body)
            .timeout(Duration::from_secs(15))
            .send()
            .await
            .map_err(|e| format!("could not reach the hub: {e}"))?;
        if !res.status().is_success() {
            return Err(error_text(res).await);
        }
        let started: LinkStartResponse = res.json().await.map_err(|e| format!("unexpected answer from the hub: {e}"))?;
        if started.api_version.unwrap_or(HUB_API_VERSION) > HUB_API_VERSION {
            return Err("This hub needs a newer Lunchpad. Update the app and try again.".into());
        }
        let generation = self.bump();
        {
            let mut inner = self.inner.lock();
            inner.status = HubStatus::Linking;
            inner.error = None;
            inner.link = Some((PendingLink { verify_url: started.verify_url.clone(), expires_at: started.expires_at }, started.poll_token.clone()));
        }
        self.emit();
        if let Err(e) = self.app.opener().open_url(&started.verify_url, None::<&str>) {
            tracing::warn!(error = %e, "could not open the browser for the hub sign-in");
        }
        let this = self.clone();
        let interval = started.interval.unwrap_or(3).clamp(2, 10);
        tauri::async_runtime::spawn(async move {
            this.link_loop(generation, started.poll_token, started.expires_at, interval).await;
        });
        Ok(self.state())
    }

    async fn link_loop(&self, generation: u64, poll_token: String, expires_at: u64, interval: u64) {
        let url = self.url();
        loop {
            tokio::time::sleep(Duration::from_secs(interval)).await;
            if self.stale(generation) {
                return;
            }
            if now_ms() > expires_at {
                self.finish_link(generation, Err("The sign-in took too long. Start again.".into()));
                return;
            }
            let res = self.client.post(format!("{url}/api/link/poll")).json(&serde_json::json!({ "pollToken": poll_token })).timeout(Duration::from_secs(15)).send().await;
            let poll: LinkPollResponse = match res {
                Ok(r) if r.status().is_success() => match r.json().await {
                    Ok(p) => p,
                    Err(e) => {
                        tracing::warn!(error = %e, "hub sign-in answer unreadable");
                        continue;
                    }
                },
                Ok(r) => {
                    self.finish_link(generation, Err(error_text(r).await));
                    return;
                }
                Err(e) => {
                    tracing::debug!(error = %e, "hub sign-in poll failed, trying again");
                    continue;
                }
            };
            match poll.status.as_str() {
                "pending" => continue,
                "approved" => match (poll.token, poll.user) {
                    (Some(token), Some(user)) => {
                        self.finish_link(generation, Ok((token, user)));
                        return;
                    }
                    _ => {
                        self.finish_link(generation, Err("The hub confirmed the sign-in but sent no token.".into()));
                        return;
                    }
                },
                "denied" => {
                    self.finish_link(generation, Err("The sign-in was cancelled in the browser.".into()));
                    return;
                }
                _ => {
                    self.finish_link(generation, Err("The sign-in took too long. Start again.".into()));
                    return;
                }
            }
        }
    }

    fn finish_link(&self, generation: u64, outcome: Result<(String, HubUser), String>) {
        if self.stale(generation) {
            return;
        }
        match outcome {
            Ok((token, user)) => {
                {
                    let mut st = self.settings.lock();
                    if let Err(e) = st.secrets.set(SecretKey::HubToken, &token) {
                        tracing::warn!(error = %e, "hub token could not be stored");
                        drop(st);
                        let mut inner = self.inner.lock();
                        inner.status = HubStatus::SignedOut;
                        inner.link = None;
                        inner.error = Some(format!("The token could not be stored in the credential store: {e}"));
                        drop(inner);
                        self.emit();
                        return;
                    }
                    st.settings.hub.user = Some(user.clone());
                    if let Err(e) = st.save() {
                        tracing::warn!(error = %e, "settings could not be saved after the hub sign-in");
                    }
                }
                {
                    let mut inner = self.inner.lock();
                    inner.token = Some(token);
                    inner.link = None;
                    inner.error = None;
                    inner.status = HubStatus::Connecting;
                }
                tracing::info!(handle = %user.handle, "signed in to the hub");
                self.start_inbox_loop();
            }
            Err(message) => {
                let mut inner = self.inner.lock();
                inner.status = HubStatus::SignedOut;
                inner.link = None;
                inner.error = Some(message);
            }
        }
        self.emit();
    }

    pub fn cancel_link(&self) -> HubState {
        self.bump();
        {
            let mut inner = self.inner.lock();
            if inner.status == HubStatus::Linking {
                inner.status = HubStatus::SignedOut;
            }
            inner.link = None;
            inner.error = None;
        }
        self.emit();
        self.state()
    }

    /// Forget the token here and, when reachable, on the hub.
    pub async fn sign_out(&self) -> HubState {
        self.bump();
        let token = self.inner.lock().token.take();
        {
            let mut inner = self.inner.lock();
            inner.status = HubStatus::SignedOut;
            inner.link = None;
            inner.error = None;
            inner.inbox.clear();
        }
        {
            let mut st = self.settings.lock();
            if let Err(e) = st.secrets.set(SecretKey::HubToken, "") {
                tracing::warn!(error = %e, "hub token could not be removed from the credential store");
            }
            st.settings.hub.user = None;
            if let Err(e) = st.save() {
                tracing::warn!(error = %e, "settings could not be saved after the hub sign-out");
            }
        }
        self.emit();
        if let Some(token) = token {
            let url = self.url();
            let _ = self.client.post(format!("{url}/api/app/logout")).bearer_auth(token).timeout(Duration::from_secs(10)).send().await;
        }
        self.state()
    }

    /// Point the app at another hub (developer mode); only while signed out.
    pub fn set_url(&self, url: &str) -> Result<HubState, String> {
        let url = url.trim().trim_end_matches('/');
        if !(url.starts_with("http://") || url.starts_with("https://")) {
            return Err("the hub address must start with http:// or https://".into());
        }
        if self.inner.lock().status != HubStatus::SignedOut {
            return Err("sign out before changing the hub address".into());
        }
        {
            let mut st = self.settings.lock();
            st.settings.hub.url = url.to_string();
            st.save().map_err(|e| e.to_string())?;
        }
        self.emit();
        Ok(self.state())
    }

    fn start_inbox_loop(&self) {
        let generation = self.bump();
        let this = self.clone();
        tauri::async_runtime::spawn(async move { this.inbox_loop(generation).await });
    }

    /// Long-poll the inbox until signed out. The first request does not wait, so
    /// the status settles at once; a 401 means the hub forgot this app.
    async fn inbox_loop(&self, generation: u64) {
        let mut wait = 0;
        loop {
            if self.stale(generation) {
                return;
            }
            let Some(token) = self.inner.lock().token.clone() else { return };
            let url = self.url();
            let res = self
                .client
                .get(format!("{url}/api/app/inbox?wait={wait}"))
                .bearer_auth(&token)
                .header("x-lunchpad-version", env!("CARGO_PKG_VERSION"))
                .header("x-lunchpad-api", HUB_API_VERSION.to_string())
                .timeout(Duration::from_secs(INBOX_WAIT_SECS + 20))
                .send()
                .await;
            if self.stale(generation) {
                return;
            }
            match res {
                Ok(r) if r.status() == reqwest::StatusCode::UNAUTHORIZED => {
                    tracing::warn!("the hub no longer accepts this app's token");
                    {
                        let mut st = self.settings.lock();
                        let _ = st.secrets.set(SecretKey::HubToken, "");
                        st.settings.hub.user = None;
                        let _ = st.save();
                    }
                    let mut inner = self.inner.lock();
                    inner.token = None;
                    inner.status = HubStatus::SignedOut;
                    inner.error = Some("The hub no longer knows this app. Sign in again.".into());
                    drop(inner);
                    self.emit();
                    return;
                }
                Ok(r) if r.status().is_success() => {
                    let items = match r.json::<InboxResponse>().await {
                        Ok(body) => body.items,
                        Err(e) => {
                            tracing::warn!(error = %e, "hub inbox answer unreadable");
                            Vec::new()
                        }
                    };
                    let mut inner = self.inner.lock();
                    let changed = inner.status != HubStatus::Connected || !items.is_empty();
                    inner.status = HubStatus::Connected;
                    inner.error = None;
                    for mut item in items {
                        if inner.inbox.iter().any(|d| d.id == item.id) {
                            continue;
                        }
                        item.received_at = now_ms();
                        tracing::info!(title = %item.title, kind = %item.kind, "delivery from the hub");
                        inner.inbox.push(item);
                    }
                    drop(inner);
                    if changed {
                        self.emit();
                    }
                    wait = INBOX_WAIT_SECS;
                }
                Ok(r) => {
                    let status = r.status();
                    let message = error_text(r).await;
                    self.offline(format!("{message} ({status})"));
                    tokio::time::sleep(Duration::from_secs(RETRY_SECS)).await;
                }
                Err(e) => {
                    self.offline(if e.is_connect() { "The hub cannot be reached.".into() } else if e.is_timeout() { "The hub did not answer in time.".into() } else { e.to_string() });
                    tokio::time::sleep(Duration::from_secs(RETRY_SECS)).await;
                }
            }
        }
    }

    fn offline(&self, message: String) {
        let mut inner = self.inner.lock();
        let changed = inner.status != HubStatus::Offline || inner.error.as_deref() != Some(message.as_str());
        inner.status = HubStatus::Offline;
        inner.error = Some(message.clone());
        drop(inner);
        if changed {
            tracing::warn!(url = %self.url(), %message, "hub inbox unavailable");
            self.emit();
        }
    }

    fn token(&self) -> Result<String, String> {
        self.inner.lock().token.clone().ok_or_else(|| "sign in to the hub first (Settings → Community hub)".to_string())
    }

    /// A request with this app's token and version headers.
    fn authed(&self, req: reqwest::RequestBuilder, token: &str) -> reqwest::RequestBuilder {
        req.bearer_auth(token).header("x-lunchpad-version", env!("CARGO_PKG_VERSION")).header("x-lunchpad-api", HUB_API_VERSION.to_string())
    }

    /// Publish a button or a page on the hub as this user.
    pub async fn share(&self, body: serde_json::Value) -> Result<ShareResult, String> {
        let token = self.token()?;
        let url = self.url();
        let res = self.authed(self.client.post(format!("{url}/api/app/listings")), &token).json(&body).timeout(Duration::from_secs(60)).send().await.map_err(|e| format!("could not reach the hub: {e}"))?;
        if !res.status().is_success() {
            return Err(error_text(res).await);
        }
        res.json::<ShareResult>().await.map_err(|e| format!("unexpected answer from the hub: {e}"))
    }

    /// Publish a new version of something shared from this app.
    pub async fn update_listing(&self, listing_id: &str, body: serde_json::Value) -> Result<ShareResult, String> {
        let token = self.token()?;
        let url = self.url();
        let res = self.authed(self.client.post(format!("{url}/api/app/listings/{listing_id}/versions")), &token).json(&body).timeout(Duration::from_secs(60)).send().await.map_err(|e| format!("could not reach the hub: {e}"))?;
        if !res.status().is_success() {
            return Err(error_text(res).await);
        }
        res.json::<ShareResult>().await.map_err(|e| format!("unexpected answer from the hub: {e}"))
    }

    /// Everything this account shared, as the hub has it.
    pub async fn my_listings(&self) -> Result<Vec<MyListing>, String> {
        let token = self.token()?;
        let url = self.url();
        let res = self.authed(self.client.get(format!("{url}/api/app/listings/mine")), &token).timeout(Duration::from_secs(30)).send().await.map_err(|e| format!("could not reach the hub: {e}"))?;
        if !res.status().is_success() {
            return Err(error_text(res).await);
        }
        res.json::<Vec<MyListing>>().await.map_err(|e| format!("unexpected answer from the hub: {e}"))
    }

    /// Remember (or refresh) what was shared, and where it lives in the profile.
    pub fn remember_shared(&self, item: SharedItem) {
        {
            let mut st = self.settings.lock();
            st.settings.hub.shared.retain(|s| s.listing_id != item.listing_id);
            st.settings.hub.shared.insert(0, item);
            if let Err(e) = st.save() {
                tracing::warn!(error = %e, "settings could not be saved after sharing");
            }
        }
        self.emit();
    }

    /// Bring the remembered list in step with the hub: statuses, titles, and what was deleted there.
    pub async fn sync_shared(&self) -> Result<HubState, String> {
        let mine = self.my_listings().await?;
        {
            let mut st = self.settings.lock();
            st.settings.hub.shared.retain(|s| mine.iter().any(|m| m.id == s.listing_id));
            for item in st.settings.hub.shared.iter_mut() {
                if let Some(m) = mine.iter().find(|m| m.id == item.listing_id) {
                    item.status = m.status.clone();
                    item.title = m.title.clone();
                }
            }
            if let Err(e) = st.save() {
                tracing::warn!(error = %e, "settings could not be saved after syncing shared items");
            }
        }
        self.emit();
        Ok(self.state())
    }

    pub fn forget_shared(&self, listing_id: &str) -> HubState {
        {
            let mut st = self.settings.lock();
            st.settings.hub.shared.retain(|s| s.listing_id != listing_id);
            let _ = st.save();
        }
        self.emit();
        self.state()
    }

    /// Store the whole profile as a private backup.
    pub async fn backup(&self, name: &str, model: Option<&str>, content: serde_json::Value) -> Result<BackupInfo, String> {
        let token = self.token()?;
        let url = self.url();
        let body = serde_json::json!({ "name": name, "model": model, "content": content });
        let res = self.authed(self.client.post(format!("{url}/api/app/backups")), &token).json(&body).timeout(Duration::from_secs(120)).send().await.map_err(|e| format!("could not reach the hub: {e}"))?;
        if !res.status().is_success() {
            return Err(error_text(res).await);
        }
        res.json::<BackupInfo>().await.map_err(|e| format!("unexpected answer from the hub: {e}"))
    }

    pub async fn list_backups(&self) -> Result<Vec<BackupInfo>, String> {
        let token = self.token()?;
        let url = self.url();
        let res = self.authed(self.client.get(format!("{url}/api/app/backups")), &token).timeout(Duration::from_secs(30)).send().await.map_err(|e| format!("could not reach the hub: {e}"))?;
        if !res.status().is_success() {
            return Err(error_text(res).await);
        }
        res.json::<Vec<BackupInfo>>().await.map_err(|e| format!("unexpected answer from the hub: {e}"))
    }

    pub async fn delete_backup(&self, id: &str) -> Result<Vec<BackupInfo>, String> {
        let token = self.token()?;
        let url = self.url();
        let res = self.authed(self.client.delete(format!("{url}/api/app/backups/{id}")), &token).timeout(Duration::from_secs(30)).send().await.map_err(|e| format!("could not reach the hub: {e}"))?;
        if !res.status().is_success() {
            return Err(error_text(res).await);
        }
        res.json::<Vec<BackupInfo>>().await.map_err(|e| format!("unexpected answer from the hub: {e}"))
    }

    /// Fetch a backup and put it in the inbox, where it is reviewed and restored like a delivery.
    pub async fn fetch_backup(&self, id: &str) -> Result<HubState, String> {
        let token = self.token()?;
        let url = self.url();
        let res = self.authed(self.client.get(format!("{url}/api/app/backups/{id}")), &token).timeout(Duration::from_secs(120)).send().await.map_err(|e| format!("could not reach the hub: {e}"))?;
        if !res.status().is_success() {
            return Err(error_text(res).await);
        }
        let backup: serde_json::Value = res.json().await.map_err(|e| format!("unexpected answer from the hub: {e}"))?;
        let delivery = Delivery {
            id: format!("backup:{id}:{}", now_ms()),
            kind: "profile".into(),
            title: backup.get("name").and_then(|v| v.as_str()).unwrap_or("Backup").to_string(),
            listing_id: String::new(),
            listing_url: format!("{url}/account"),
            version_number: 0,
            author: None,
            risk: "safe".into(),
            format_version: backup.get("formatVersion").and_then(|v| v.as_u64()).map(|v| v as u32),
            app_version: backup.get("appVersion").and_then(|v| v.as_str()).map(String::from),
            content: backup.get("content").cloned().ok_or_else(|| "the backup is empty".to_string())?,
            received_at: now_ms(),
            fetched: true,
        };
        self.inner.lock().inbox.push(delivery);
        self.emit();
        Ok(self.state())
    }

    pub fn delivery(&self, id: &str) -> Option<Delivery> {
        self.inner.lock().inbox.iter().find(|d| d.id == id).cloned()
    }

    /// Drop a delivery from the inbox and tell the hub what became of it.
    pub fn settle(&self, id: &str, applied: bool) -> HubState {
        let removed = {
            let mut inner = self.inner.lock();
            let before = inner.inbox.len();
            let fetched = inner.inbox.iter().find(|d| d.id == id).map(|d| d.fetched).unwrap_or(true);
            inner.inbox.retain(|d| d.id != id);
            inner.inbox.len() != before && !fetched
        };
        self.emit();
        if removed {
            if let Some(token) = self.inner.lock().token.clone() {
                let url = self.url();
                let client = self.client.clone();
                let id = id.to_string();
                tauri::async_runtime::spawn(async move {
                    let _ = client
                        .post(format!("{url}/api/app/inbox/{id}/ack"))
                        .bearer_auth(token)
                        .json(&serde_json::json!({ "status": if applied { "applied" } else { "dismissed" } }))
                        .timeout(Duration::from_secs(10))
                        .send()
                        .await;
                });
            }
        }
        self.state()
    }

    /// Fetch a listing by id or share link and put it in the inbox.
    pub async fn fetch_listing(&self, reference: &str) -> Result<HubState, String> {
        let id = reference.trim().trim_end_matches('/').rsplit('/').next().unwrap_or("").trim();
        if id.is_empty() {
            return Err("paste a hub link or a listing id".into());
        }
        let Some(token) = self.inner.lock().token.clone() else { return Err("sign in to the hub first".into()) };
        let url = self.url();
        let res = self.client.get(format!("{url}/api/app/listings/{id}")).bearer_auth(token).timeout(Duration::from_secs(20)).send().await.map_err(|e| format!("could not reach the hub: {e}"))?;
        if !res.status().is_success() {
            return Err(error_text(res).await);
        }
        let listing: serde_json::Value = res.json().await.map_err(|e| format!("unexpected answer from the hub: {e}"))?;
        let version = listing.get("version").cloned().unwrap_or_default();
        let owner = listing.get("owner").cloned().unwrap_or_default();
        let delivery = Delivery {
            id: format!("fetched:{id}:{}", now_ms()),
            kind: listing.get("kind").and_then(|v| v.as_str()).unwrap_or("page").to_string(),
            title: listing.get("title").and_then(|v| v.as_str()).unwrap_or("Untitled").to_string(),
            listing_id: id.to_string(),
            listing_url: format!("{url}/l/{id}"),
            version_number: version.get("number").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
            author: Some(DeliveryAuthor { handle: owner.get("handle").and_then(|v| v.as_str()).unwrap_or("").to_string(), name: owner.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string() }),
            risk: version.get("risk").and_then(|v| v.as_str()).unwrap_or("safe").to_string(),
            format_version: version.get("stats").and_then(|s| s.get("formatVersion")).and_then(|v| v.as_u64()).map(|v| v as u32),
            app_version: version.get("stats").and_then(|s| s.get("appVersion")).and_then(|v| v.as_str()).map(String::from),
            content: version.get("content").cloned().ok_or_else(|| "the listing has no published version".to_string())?,
            received_at: now_ms(),
            fetched: true,
        };
        self.inner.lock().inbox.push(delivery);
        self.emit();
        Ok(self.state())
    }
}
