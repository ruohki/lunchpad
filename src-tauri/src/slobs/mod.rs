//! Streamlabs Desktop integration over its JSON-RPC API.
//!
//! Streamlabs Desktop listens on `127.0.0.1:28194` (plain TCP, one JSON-RPC 2.0
//! message per line) whenever it runs; connections from the same machine are
//! trusted without a token. A supervisor task keeps the connection up while the
//! integration is enabled. Actions refer to scenes, sources and collections by
//! name (like the OBS actions) and resolve Streamlabs' ids at run time from a
//! cached catalog that event subscriptions keep current.

use crate::config::SharedSettings;
use crate::live::LiveHandle;
use crate::macros::{MuteMode, ObsMode, ObsTarget, StudioMode, VolumeUnit};
use crate::profile::LinkProvider;
use parking_lot::Mutex;
use serde::Serialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::tcp::{OwnedReadHalf, OwnedWriteHalf};
use tokio::net::TcpStream;
use tokio::runtime::Handle;
use tokio::sync::{mpsc, oneshot, Mutex as AsyncMutex};

pub const EVENT_SLOBS_STATE: &str = "slobs:state";
const CONNECT_TIMEOUT: Duration = Duration::from_secs(5);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(10);
/// Events arrive in bursts (a collection switch fires dozens); reload once they settle.
const REFRESH_DEBOUNCE: Duration = Duration::from_millis(300);

/// Subscriptions that invalidate the catalog or the status fields.
const SUBSCRIPTIONS: &[(&str, &[&str])] = &[
    ("ScenesService", &["sceneSwitched", "sceneAdded", "sceneRemoved", "itemAdded", "itemRemoved", "itemUpdated"]),
    ("SourcesService", &["sourceAdded", "sourceRemoved", "sourceUpdated"]),
    ("AudioService", &["audioSourceUpdated"]),
    ("SceneCollectionsService", &["collectionSwitched", "collectionAdded", "collectionRemoved", "collectionUpdated"]),
    ("StreamingService", &["streamingStatusChange", "recordingStatusChange", "replayBufferStatusChange"]),
    ("TransitionsService", &["studioModeChanged"]),
];

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SlobsState {
    pub connected: bool,
    pub error: Option<String>,
    pub collections: Vec<String>,
    pub current_collection: Option<String>,
    pub scenes: Vec<String>,
    pub current_scene: Option<String>,
    /// Every source of the active collection, by name
    pub sources: Vec<String>,
    /// Sources with an audio track (what the mixer shows)
    pub audio_sources: Vec<String>,
    /// `(scene, source)` pairs whose scene item is visible
    pub visible: Vec<(String, String)>,
    /// Muted mixer sources
    pub muted: Vec<String>,
    pub studio_mode: bool,
    /// `offline`, `starting`, `live`, `ending`, `reconnecting`
    pub streaming: String,
    /// `offline`, `starting`, `recording`, `stopping`
    pub recording: String,
    /// `offline`, `running`, `stopping`, `saving`
    pub replay_buffer: String,
}

/// The ids behind the names in [`SlobsState`], as `(id, name)` pairs.
#[derive(Debug, Clone, Default)]
struct Catalog {
    collections: Vec<(String, String)>,
    scenes: Vec<(String, String)>,
    sources: Vec<(String, String)>,
}

#[derive(Debug, Clone, Copy)]
enum Kind {
    Collection,
    Scene,
    Source,
}

impl Kind {
    fn label(self) -> &'static str {
        match self {
            Kind::Collection => "scene collection",
            Kind::Scene => "scene",
            Kind::Source => "source",
        }
    }
}

// ----- JSON-RPC client ------------------------------------------------------

enum Incoming {
    Event(Value),
    Closed { generation: u64, reason: String },
}

type Pending = Arc<Mutex<HashMap<u64, oneshot::Sender<Result<Value, String>>>>>;

/// One TCP connection: writes requests, a reader task routes answers by id and
/// forwards events. Dropping the client ends the reader.
struct Client {
    writer: AsyncMutex<OwnedWriteHalf>,
    pending: Pending,
    next_id: AtomicU64,
    reader: tokio::task::JoinHandle<()>,
}

impl Client {
    async fn connect(host: &str, port: u16, generation: u64, incoming: mpsc::UnboundedSender<Incoming>) -> Result<Client, String> {
        let stream = tokio::time::timeout(CONNECT_TIMEOUT, TcpStream::connect((host, port)))
            .await
            .map_err(|_| format!("no answer from {host}:{port}"))?
            .map_err(|e| format!("{host}:{port}: {e}"))?;
        let _ = stream.set_nodelay(true);
        let (read, write) = stream.into_split();
        let pending: Pending = Arc::new(Mutex::new(HashMap::new()));
        let reader = tokio::spawn(read_loop(read, pending.clone(), incoming, generation));
        Ok(Client { writer: AsyncMutex::new(write), pending, next_id: AtomicU64::new(1), reader })
    }

    /// Call `method` on `resource` (e.g. `ScenesService`, `Scene["id"]`).
    async fn call(&self, resource: &str, method: &str, args: Vec<Value>) -> Result<Value, String> {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let (tx, rx) = oneshot::channel();
        self.pending.lock().insert(id, tx);
        let mut line = request_line(id, resource, method, args);
        line.push('\n');
        {
            let mut writer = self.writer.lock().await;
            if let Err(e) = writer.write_all(line.as_bytes()).await {
                self.pending.lock().remove(&id);
                return Err(format!("write to Streamlabs failed: {e}"));
            }
        }
        match tokio::time::timeout(REQUEST_TIMEOUT, rx).await {
            Ok(Ok(result)) => result,
            Ok(Err(_)) => Err("Streamlabs connection closed".into()),
            Err(_) => {
                self.pending.lock().remove(&id);
                Err(format!("no answer from Streamlabs for {resource}.{method}"))
            }
        }
    }
}

impl Drop for Client {
    fn drop(&mut self) {
        self.reader.abort();
    }
}

fn request_line(id: u64, resource: &str, method: &str, args: Vec<Value>) -> String {
    json!({
        "jsonrpc": "2.0",
        "id": id,
        "method": method,
        "params": { "resource": resource, "args": args, "compactMode": false },
    })
    .to_string()
}

/// Sort one incoming message: an answer (has an `id`) or an event.
fn dispatch(msg: Value, pending: &Pending, incoming: &mpsc::UnboundedSender<Incoming>) {
    if let Some(id) = msg.get("id").and_then(Value::as_u64) {
        if let Some(tx) = pending.lock().remove(&id) {
            let result = match msg.get("error") {
                Some(err) => Err(err.get("message").and_then(Value::as_str).unwrap_or("request failed").to_string()),
                None => Ok(msg.get("result").cloned().unwrap_or(Value::Null)),
            };
            let _ = tx.send(result);
        }
        return;
    }
    if msg.pointer("/result/_type").and_then(Value::as_str) == Some("EVENT") {
        let _ = incoming.send(Incoming::Event(msg["result"].clone()));
    }
}

async fn read_loop(read: OwnedReadHalf, pending: Pending, incoming: mpsc::UnboundedSender<Incoming>, generation: u64) {
    let mut lines = BufReader::with_capacity(1 << 16, read).lines();
    let reason = loop {
        match lines.next_line().await {
            Ok(Some(line)) => {
                if line.trim().is_empty() {
                    continue;
                }
                match serde_json::from_str::<Value>(&line) {
                    Ok(msg) => dispatch(msg, &pending, &incoming),
                    Err(e) => tracing::debug!(error = %e, "unparsable line from Streamlabs"),
                }
            }
            Ok(None) => break "Streamlabs closed the connection".to_string(),
            Err(e) => break e.to_string(),
        }
    };
    for (_, tx) in pending.lock().drain() {
        let _ = tx.send(Err(reason.clone()));
    }
    let _ = incoming.send(Incoming::Closed { generation, reason });
}

// ----- handle ---------------------------------------------------------------

struct Inner {
    client: AsyncMutex<Option<Arc<Client>>>,
    /// Bumped per connection so a stale reader cannot close a newer one.
    generation: AtomicU64,
    state: Mutex<SlobsState>,
    catalog: Mutex<Catalog>,
    settings: SharedSettings,
    app: Option<AppHandle>,
    live: Option<LiveHandle>,
    /// Set by `disconnect` so the supervisor does not reconnect until asked.
    manual_off: Mutex<bool>,
    /// Serialises `connect` so the supervisor and a command cannot open two connections.
    connecting: AsyncMutex<()>,
    incoming: mpsc::UnboundedSender<Incoming>,
}

#[derive(Clone)]
pub struct SlobsHandle {
    inner: Arc<Inner>,
}

impl SlobsHandle {
    /// Create the handle and start the supervisor and event pump on `runtime`.
    pub fn spawn(app: Option<AppHandle>, settings: SharedSettings, runtime: &Handle, live: Option<LiveHandle>) -> SlobsHandle {
        let (tx, rx) = mpsc::unbounded_channel();
        let handle = SlobsHandle {
            inner: Arc::new(Inner {
                client: AsyncMutex::new(None),
                generation: AtomicU64::new(0),
                state: Mutex::new(SlobsState::default()),
                catalog: Mutex::new(Catalog::default()),
                settings,
                app,
                live,
                manual_off: Mutex::new(false),
                connecting: AsyncMutex::new(()),
                incoming: tx,
            }),
        };
        let supervisor = handle.clone();
        runtime.spawn(async move { supervisor.supervise().await });
        let pump = handle.clone();
        runtime.spawn(async move { pump.pump(rx).await });
        handle
    }

    pub fn state(&self) -> SlobsState {
        self.inner.state.lock().clone()
    }

    fn publish(&self) {
        if let Some(app) = &self.inner.app {
            let _ = app.emit(EVENT_SLOBS_STATE, self.state());
        }
    }

    fn set_state(&self, f: impl FnOnce(&mut SlobsState)) {
        f(&mut self.inner.state.lock());
        self.publish();
        self.sync_live();
    }

    /// Mirror the state into the live status the LED renderer reads.
    fn sync_live(&self) {
        let Some(live) = &self.inner.live else { return };
        let s = self.inner.state.lock().clone();
        live.update(LinkProvider::Slobs, |p| {
            p.connected = s.connected;
            p.current_scene = s.current_scene.clone();
            p.visible = s.visible.iter().cloned().collect();
            p.muted = s.muted.iter().cloned().collect();
            p.streaming = s.streaming != "offline";
            p.recording = s.recording != "offline";
            p.replay_buffer = s.replay_buffer != "offline";
        });
    }

    async fn client(&self) -> Result<Arc<Client>, String> {
        self.inner.client.lock().await.clone().ok_or_else(|| "Streamlabs Desktop is not connected".to_string())
    }

    async fn supervise(self) {
        let mut backoff = Duration::from_secs(2);
        loop {
            let (enabled, auto) = {
                let st = self.inner.settings.lock();
                (st.settings.slobs.enabled, st.settings.slobs.auto_connect)
            };
            let connected = self.inner.client.lock().await.is_some();
            let manual_off = *self.inner.manual_off.lock();
            if enabled && auto && !connected && !manual_off {
                match self.connect().await {
                    Ok(()) => backoff = Duration::from_secs(2),
                    Err(_) => backoff = (backoff * 2).min(Duration::from_secs(30)),
                }
            } else if !enabled && connected {
                self.disconnect().await;
            } else {
                backoff = Duration::from_secs(2);
            }
            tokio::time::sleep(backoff).await;
        }
    }

    /// Consumes reader notifications: connection loss, and events that trigger
    /// one catalog reload after they settle.
    async fn pump(self, mut rx: mpsc::UnboundedReceiver<Incoming>) {
        let mut dirty = false;
        loop {
            let msg = if dirty {
                match tokio::time::timeout(REFRESH_DEBOUNCE, rx.recv()).await {
                    Ok(Some(msg)) => msg,
                    Ok(None) => break,
                    Err(_) => {
                        dirty = false;
                        if self.inner.client.lock().await.is_some() {
                            if let Err(e) = self.refresh().await {
                                tracing::debug!(error = %e, "Streamlabs reload after event failed");
                            }
                        }
                        continue;
                    }
                }
            } else {
                match rx.recv().await {
                    Some(msg) => msg,
                    None => break,
                }
            };
            match msg {
                Incoming::Closed { generation, reason } => {
                    if generation == self.inner.generation.load(Ordering::Relaxed) {
                        *self.inner.client.lock().await = None;
                        tracing::warn!(reason = %reason, "Streamlabs connection lost");
                        self.set_state(|s| {
                            s.connected = false;
                            s.error = Some(reason);
                        });
                        dirty = false;
                    }
                }
                Incoming::Event(event) => {
                    let resource = event.get("resourceId").and_then(|v| v.as_str()).unwrap_or("?");
                    tracing::debug!(resource, "Streamlabs event");
                    dirty = true;
                }
            }
        }
    }

    /// Connect with the current settings, subscribe to change events and load
    /// the catalog for the editors.
    pub async fn connect(&self) -> Result<(), String> {
        let _guard = self.inner.connecting.lock().await;
        *self.inner.manual_off.lock() = false;
        if self.inner.client.lock().await.is_some() {
            return Ok(());
        }
        let (host, port, token) = {
            let st = self.inner.settings.lock();
            let s = &st.settings.slobs;
            (s.host.clone(), s.port, s.token.clone())
        };
        let generation = self.inner.generation.fetch_add(1, Ordering::Relaxed) + 1;
        let client = match Client::connect(&host, port, generation, self.inner.incoming.clone()).await {
            Ok(c) => Arc::new(c),
            Err(msg) => {
                tracing::warn!(host, port, error = %msg, "Streamlabs connection failed");
                self.set_state(|s| {
                    s.connected = false;
                    s.error = Some(msg.clone());
                });
                return Err(msg);
            }
        };
        // Local TCP clients are trusted; a token is only checked for remote hosts.
        if !token.trim().is_empty() {
            if let Err(e) = client.call("TcpServerService", "auth", vec![json!(token.trim())]).await {
                let msg = format!("Streamlabs rejected the token: {e}");
                self.set_state(|s| {
                    s.connected = false;
                    s.error = Some(msg.clone());
                });
                return Err(msg);
            }
        }
        *self.inner.client.lock().await = Some(client.clone());
        tracing::info!(host, port, "Streamlabs Desktop connected");
        self.set_state(|s| {
            s.connected = true;
            s.error = None;
        });
        for (resource, events) in SUBSCRIPTIONS {
            for event in *events {
                if let Err(e) = client.call(resource, event, vec![]).await {
                    tracing::debug!(resource, event, error = %e, "Streamlabs subscription not available");
                }
            }
        }
        if let Err(e) = self.refresh().await {
            tracing::warn!(error = %e, "Streamlabs lists could not be loaded");
        }
        Ok(())
    }

    pub async fn disconnect(&self) {
        *self.inner.manual_off.lock() = true;
        self.inner.generation.fetch_add(1, Ordering::Relaxed);
        self.inner.client.lock().await.take();
        self.set_state(|s| {
            s.connected = false;
            s.error = None;
        });
    }

    /// Reload collections, scenes, sources and the status fields.
    pub async fn refresh(&self) -> Result<(), String> {
        let client = self.client().await?;
        let collections = client.call("SceneCollectionsService", "collections", vec![]).await?;
        let active_collection = client.call("SceneCollectionsService", "activeCollection", vec![]).await?;
        // `ScenesService.getScenes` is rate limited (one call per second); scenes are
        // also sources of type "scene" whose source id is the scene id, and
        // `getSceneNames` gives the display order for free.
        let scene_names = client.call("ScenesService", "getSceneNames", vec![]).await?;
        let active_scene = client.call("ScenesService", "activeSceneId", vec![]).await?;
        let sources = client.call("SourcesService", "getSources", vec![]).await?;
        let audio = client.call("AudioService", "getSources", vec![]).await?;
        let streaming = client.call("StreamingService", "getModel", vec![]).await?;
        let transitions = client.call("TransitionsService", "getModel", vec![]).await?;

        let pairs = |v: &Value, id_key: &str| -> Vec<(String, String)> {
            v.as_array()
                .map(|items| {
                    items
                        .iter()
                        .filter_map(|it| Some((it.get(id_key)?.as_str()?.to_string(), it.get("name")?.as_str()?.to_string())))
                        .collect()
                })
                .unwrap_or_default()
        };
        let order: Vec<&str> = scene_names.as_array().map(|n| n.iter().filter_map(Value::as_str).collect()).unwrap_or_default();
        let mut scenes: Vec<(String, String)> = sources
            .as_array()
            .map(|items| {
                items
                    .iter()
                    .filter(|it| it.get("type").and_then(Value::as_str) == Some("scene"))
                    .filter_map(|it| Some((it.get("sourceId")?.as_str()?.to_string(), it.get("name")?.as_str()?.to_string())))
                    .collect()
            })
            .unwrap_or_default();
        scenes.sort_by_key(|(_, name)| order.iter().position(|n| n == name).unwrap_or(usize::MAX));
        let catalog = Catalog { collections: pairs(&collections, "id"), scenes, sources: pairs(&sources, "sourceId") };
        let audio_sources: Vec<String> = pairs(&audio, "sourceId").into_iter().map(|(_, name)| name).collect();
        let muted: Vec<String> = audio
            .as_array()
            .map(|items| {
                items
                    .iter()
                    .filter(|it| it.get("muted").and_then(Value::as_bool) == Some(true))
                    .filter_map(|it| it.get("name")?.as_str().map(str::to_string))
                    .collect()
            })
            .unwrap_or_default();
        // Visible items per scene, for buttons linked to a source.
        let mut visible: Vec<(String, String)> = Vec::new();
        for (id, scene_name) in &catalog.scenes {
            let items = client.call(&format!("Scene[\"{id}\"]"), "getItems", vec![]).await?;
            for it in items.as_array().into_iter().flatten() {
                if it.get("visible").and_then(Value::as_bool) == Some(true) {
                    if let Some(name) = it.get("name").and_then(Value::as_str) {
                        visible.push((scene_name.clone(), name.to_string()));
                    }
                }
            }
        }
        let status = |key: &str| streaming.get(key).and_then(Value::as_str).unwrap_or("offline").to_string();
        let current_collection = active_collection.get("name").and_then(Value::as_str).map(str::to_string);
        let current_scene = active_scene.as_str().and_then(|id| catalog.scenes.iter().find(|(i, _)| i == id)).map(|(_, n)| n.clone());
        let studio_mode = transitions.get("studioMode").and_then(Value::as_bool).unwrap_or(false);

        self.set_state(|s| {
            s.collections = catalog.collections.iter().map(|(_, n)| n.clone()).collect();
            s.current_collection = current_collection;
            s.scenes = catalog.scenes.iter().map(|(_, n)| n.clone()).collect();
            s.current_scene = current_scene;
            s.sources = catalog.sources.iter().map(|(_, n)| n.clone()).collect();
            s.audio_sources = audio_sources;
            s.visible = visible;
            s.muted = muted;
            s.studio_mode = studio_mode;
            s.streaming = status("streamingStatus");
            s.recording = status("recordingStatus");
            s.replay_buffer = status("replayBufferStatus");
        });
        *self.inner.catalog.lock() = catalog;
        Ok(())
    }

    fn cached_id(&self, kind: Kind, name: &str) -> Option<String> {
        let catalog = self.inner.catalog.lock();
        let list = match kind {
            Kind::Collection => &catalog.collections,
            Kind::Scene => &catalog.scenes,
            Kind::Source => &catalog.sources,
        };
        list.iter().find(|(_, n)| n == name).map(|(id, _)| id.clone())
    }

    /// Id for a name; reloads the catalog once when the name is unknown.
    async fn id_of(&self, kind: Kind, name: &str) -> Result<String, String> {
        if let Some(id) = self.cached_id(kind, name) {
            return Ok(id);
        }
        self.refresh().await?;
        self.cached_id(kind, name).ok_or_else(|| format!("{} \"{name}\" not found in Streamlabs", kind.label()))
    }

    async fn ensure_collection(&self, collection: Option<&str>) -> Result<(), String> {
        let Some(wanted) = collection else { return Ok(()) };
        if self.inner.state.lock().current_collection.as_deref() == Some(wanted) {
            return Ok(());
        }
        let id = self.id_of(Kind::Collection, wanted).await?;
        self.client().await?.call("SceneCollectionsService", "load", vec![json!(id)]).await?;
        // Loading replaces every scene and source; let the events settle, then reload.
        tokio::time::sleep(Duration::from_millis(400)).await;
        self.refresh().await
    }

    pub async fn filters(&self, source: &str) -> Result<Vec<String>, String> {
        let id = self.id_of(Kind::Source, source).await?;
        let list = self.client().await?.call("SourceFiltersService", "getFilters", vec![json!(id)]).await?;
        Ok(list
            .as_array()
            .map(|items| items.iter().filter_map(|f| f.get("name")?.as_str().map(str::to_string)).collect())
            .unwrap_or_default())
    }

    pub async fn switch_scene(&self, collection: Option<&str>, scene: &str) -> Result<(), String> {
        self.ensure_collection(collection).await?;
        let id = self.id_of(Kind::Scene, scene).await?;
        let ok = self.client().await?.call("ScenesService", "makeSceneActive", vec![json!(id)]).await?;
        if ok.as_bool() == Some(false) {
            return Err(format!("scene \"{scene}\" could not be activated"));
        }
        Ok(())
    }

    /// Show, hide (`Some`) or flip (`None`) every item of `source` in `scene`.
    pub async fn set_source_visible(&self, collection: Option<&str>, scene: &str, source: &str, visible: Option<bool>) -> Result<(), String> {
        self.ensure_collection(collection).await?;
        let scene_id = self.id_of(Kind::Scene, scene).await?;
        let client = self.client().await?;
        let items = client.call(&format!("Scene[\"{scene_id}\"]"), "getItems", vec![]).await?;
        let targets: Vec<(String, bool)> = items
            .as_array()
            .map(|list| {
                list.iter()
                    .filter(|it| it.get("name").and_then(Value::as_str) == Some(source))
                    .filter_map(|it| Some((it.get("resourceId")?.as_str()?.to_string(), it.get("visible").and_then(Value::as_bool).unwrap_or(true))))
                    .collect()
            })
            .unwrap_or_default();
        if targets.is_empty() {
            return Err(format!("source \"{source}\" is not in scene \"{scene}\""));
        }
        for (resource, now) in targets {
            client.call(&resource, "setVisibility", vec![json!(visible.unwrap_or(!now))]).await?;
        }
        Ok(())
    }

    /// Mute and set the volume: dB mapped onto the mixer fader, or percent as
    /// the fader position itself (100 % = fader at the top).
    pub async fn set_audio(&self, source: &str, mute: MuteMode, volume: Option<(f32, VolumeUnit)>) -> Result<(), String> {
        let id = self.id_of(Kind::Source, source).await?;
        let resource = format!("AudioSource[\"{id}\"]");
        let client = self.client().await?;
        let muted = match mute {
            MuteMode::Mute => Some(true),
            MuteMode::Unmute => Some(false),
            MuteMode::Toggle => {
                let model = client.call(&resource, "getModel", vec![]).await?;
                Some(!model.get("muted").and_then(Value::as_bool).unwrap_or(false))
            }
            MuteMode::Keep => None,
        };
        if let Some(muted) = muted {
            client.call(&resource, "setMuted", vec![json!(muted)]).await?;
        }
        if let Some((level, unit)) = volume {
            let deflection = match unit {
                VolumeUnit::Db => db_to_deflection(level),
                VolumeUnit::Percent => (level / 100.0).clamp(0.0, 1.0),
            };
            client.call(&resource, "setDeflection", vec![json!(deflection)]).await?;
        }
        Ok(())
    }

    pub async fn set_filter(&self, source: &str, filter: &str, enabled: bool) -> Result<(), String> {
        let id = self.id_of(Kind::Source, source).await?;
        self.client().await?.call("SourceFiltersService", "setVisibility", vec![json!(id), json!(filter), json!(enabled)]).await?;
        Ok(())
    }

    /// Start, stop or toggle the stream, the recording or the replay buffer.
    /// Streamlabs only offers toggles, so start/stop first read the status.
    pub async fn output(&self, target: ObsTarget, mode: ObsMode) -> Result<(), String> {
        let client = self.client().await?;
        let model = client.call("StreamingService", "getModel", vec![]).await?;
        let active = |key: &str| model.get(key).and_then(Value::as_str).map(|s| s != "offline").unwrap_or(false);
        let (on, toggle_on, toggle_off): (bool, &str, &str) = match target {
            ObsTarget::Stream => (active("streamingStatus"), "toggleStreaming", "toggleStreaming"),
            ObsTarget::Record => (active("recordingStatus"), "toggleRecording", "toggleRecording"),
            ObsTarget::Replay => (active("replayBufferStatus"), "startReplayBuffer", "stopReplayBuffer"),
        };
        let method = match (mode, on) {
            (ObsMode::Start, true) | (ObsMode::Stop, false) => return Ok(()),
            (ObsMode::Start, false) | (ObsMode::Toggle, false) => toggle_on,
            (ObsMode::Stop, true) | (ObsMode::Toggle, true) => toggle_off,
        };
        client.call("StreamingService", method, vec![]).await?;
        Ok(())
    }

    pub async fn save_replay(&self) -> Result<(), String> {
        self.client().await?.call("StreamingService", "saveReplay", vec![]).await?;
        Ok(())
    }

    pub async fn studio_mode(&self, mode: StudioMode) -> Result<(), String> {
        let client = self.client().await?;
        let model = client.call("TransitionsService", "getModel", vec![]).await?;
        let on = model.get("studioMode").and_then(Value::as_bool).unwrap_or(false);
        let method = match (mode, on) {
            (StudioMode::Enable, true) | (StudioMode::Disable, false) => return Ok(()),
            (StudioMode::Enable, false) | (StudioMode::Toggle, false) => "enableStudioMode",
            (StudioMode::Disable, true) | (StudioMode::Toggle, true) => "disableStudioMode",
            (StudioMode::Transition, true) => "executeStudioModeTransition",
            (StudioMode::Transition, false) => return Err("studio mode is off, nothing to transition".into()),
        };
        client.call("TransitionsService", method, vec![]).await?;
        Ok(())
    }
}

/// Fader position (0..1) for a dB value on the IEC 60268-18 scale that the
/// Streamlabs mixer uses (`setDeflection`); -20 dB sits at the middle.
pub fn db_to_deflection(db: f32) -> f32 {
    if db >= 0.0 {
        return 1.0;
    }
    let def = if db >= -9.0 {
        (db + 9.0) / 9.0 * 0.25 + 0.75
    } else if db >= -20.0 {
        (db + 20.0) / 11.0 * 0.25 + 0.5
    } else if db >= -30.0 {
        (db + 30.0) / 10.0 * 0.2 + 0.3
    } else if db >= -40.0 {
        (db + 40.0) / 10.0 * 0.15 + 0.15
    } else if db >= -50.0 {
        (db + 50.0) / 10.0 * 0.075 + 0.075
    } else if db >= -60.0 {
        (db + 60.0) / 10.0 * 0.05 + 0.025
    } else if db >= -90.0 {
        (db + 90.0) / 30.0 * 0.025
    } else {
        0.0
    };
    def.clamp(0.0, 1.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn iec_fader_positions() {
        assert_eq!(db_to_deflection(0.0), 1.0);
        assert_eq!(db_to_deflection(6.0), 1.0);
        assert!((db_to_deflection(-9.0) - 0.75).abs() < 1e-6);
        assert!((db_to_deflection(-20.0) - 0.5).abs() < 1e-6);
        assert!((db_to_deflection(-30.0) - 0.3).abs() < 1e-6);
        assert!((db_to_deflection(-60.0) - 0.025).abs() < 1e-6);
        assert_eq!(db_to_deflection(-100.0), 0.0);
        // monotonic
        let mut last = 0.0;
        for step in 0..=100 {
            let v = db_to_deflection(-100.0 + step as f32);
            assert!(v >= last);
            last = v;
        }
    }

    #[test]
    fn request_shape() {
        let line = request_line(7, "ScenesService", "makeSceneActive", vec![json!("scene_1")]);
        let v: Value = serde_json::from_str(&line).unwrap();
        assert_eq!(v["jsonrpc"], "2.0");
        assert_eq!(v["id"], 7);
        assert_eq!(v["method"], "makeSceneActive");
        assert_eq!(v["params"]["resource"], "ScenesService");
        assert_eq!(v["params"]["args"][0], "scene_1");
        assert_eq!(v["params"]["compactMode"], false);
        assert!(!line.contains('\n'));
    }

    #[test]
    fn dispatch_routes_answers_and_events() {
        let pending: Pending = Arc::new(Mutex::new(HashMap::new()));
        let (tx, mut rx) = mpsc::unbounded_channel();
        let (ok_tx, ok_rx) = oneshot::channel();
        let (err_tx, err_rx) = oneshot::channel();
        pending.lock().insert(1, ok_tx);
        pending.lock().insert(2, err_tx);

        dispatch(json!({"id": 1, "jsonrpc": "2.0", "result": true}), &pending, &tx);
        dispatch(json!({"id": 2, "jsonrpc": "2.0", "error": {"code": -32601, "message": "METHOD_NOT_FOUND nope"}}), &pending, &tx);
        dispatch(json!({"id": null, "jsonrpc": "2.0", "result": {"_type": "EVENT", "resourceId": "ScenesService.sceneSwitched", "data": {}}}), &pending, &tx);
        dispatch(json!({"id": 99, "jsonrpc": "2.0", "result": null}), &pending, &tx);

        assert_eq!(ok_rx.blocking_recv().unwrap().unwrap(), json!(true));
        assert_eq!(err_rx.blocking_recv().unwrap().unwrap_err(), "METHOD_NOT_FOUND nope");
        match rx.try_recv() {
            Ok(Incoming::Event(ev)) => assert_eq!(ev["resourceId"], "ScenesService.sceneSwitched"),
            _ => panic!("event expected"),
        }
        assert!(rx.try_recv().is_err());
        assert!(pending.lock().is_empty());
    }
}
