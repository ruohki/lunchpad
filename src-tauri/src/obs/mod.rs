//! OBS Studio integration over obs-websocket 5 (`obws`). A supervisor task
//! keeps the connection up while the integration is enabled; actions call the
//! client directly. Scene / input lists are cached for the editors, and the
//! event stream keeps the live status (current scene, visible sources, mute,
//! stream / record / replay state) current for state-linked button colours.

use crate::config::SharedSettings;
use crate::live::LiveHandle;
use crate::macros::{MuteMode, ObsMode, ObsTarget, StudioMode, VolumeUnit};
use crate::profile::LinkProvider;
use obws::events::Event;
use obws::requests::inputs::Volume;
use obws::Client;
use parking_lot::Mutex;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::runtime::Handle;
use tokio::sync::Mutex as AsyncMutex;
use tokio_stream::StreamExt;

pub const EVENT_OBS_STATE: &str = "obs:state";
/// Structural events (scenes or inputs added, renamed, …) reload the lists once they settle.
const REFRESH_DEBOUNCE: Duration = Duration::from_millis(300);

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ObsState {
    pub connected: bool,
    pub error: Option<String>,
    pub collections: Vec<String>,
    pub current_collection: Option<String>,
    pub scenes: Vec<String>,
    pub current_scene: Option<String>,
    pub inputs: Vec<String>,
    /// `(scene, source)` pairs whose scene item is enabled
    pub visible: Vec<(String, String)>,
    pub muted: Vec<String>,
    pub streaming: bool,
    pub recording: bool,
    pub replay_buffer: bool,
}

struct Inner {
    client: AsyncMutex<Option<Client>>,
    /// Bumped per connection so a finished event stream cannot close a newer one.
    generation: AtomicU64,
    state: Mutex<ObsState>,
    /// `(scene, item id)` → source name, to read item events
    items: Mutex<HashMap<(String, i64), String>>,
    settings: SharedSettings,
    app: Option<AppHandle>,
    live: Option<LiveHandle>,
    /// Set by `disconnect` so the supervisor does not reconnect until asked.
    manual_off: Mutex<bool>,
    refresh_pending: AtomicBool,
}

#[derive(Clone)]
pub struct ObsHandle {
    inner: Arc<Inner>,
}

impl ObsHandle {
    /// Create the handle and start the supervisor on `runtime`.
    pub fn spawn(app: Option<AppHandle>, settings: SharedSettings, runtime: &Handle, live: Option<LiveHandle>) -> ObsHandle {
        let handle = ObsHandle {
            inner: Arc::new(Inner {
                client: AsyncMutex::new(None),
                generation: AtomicU64::new(0),
                state: Mutex::new(ObsState::default()),
                items: Mutex::new(HashMap::new()),
                settings,
                app,
                live,
                manual_off: Mutex::new(false),
                refresh_pending: AtomicBool::new(false),
            }),
        };
        let supervisor = handle.clone();
        runtime.spawn(async move { supervisor.supervise().await });
        handle
    }

    pub fn state(&self) -> ObsState {
        self.inner.state.lock().clone()
    }

    fn publish(&self) {
        if let Some(app) = &self.inner.app {
            let _ = app.emit(EVENT_OBS_STATE, self.state());
        }
    }

    fn set_state(&self, f: impl FnOnce(&mut ObsState)) {
        f(&mut self.inner.state.lock());
        self.publish();
        self.sync_live();
    }

    /// Mirror the state into the live status the LED renderer reads.
    fn sync_live(&self) {
        let Some(live) = &self.inner.live else { return };
        let s = self.inner.state.lock().clone();
        live.update(LinkProvider::Obs, |p| {
            p.connected = s.connected;
            p.current_scene = s.current_scene.clone();
            p.visible = s.visible.iter().cloned().collect();
            p.muted = s.muted.iter().cloned().collect();
            p.streaming = s.streaming;
            p.recording = s.recording;
            p.replay_buffer = s.replay_buffer;
        });
    }

    async fn supervise(self) {
        let mut backoff = Duration::from_secs(2);
        loop {
            let (enabled, auto) = {
                let st = self.inner.settings.lock();
                (st.settings.obs.enabled, st.settings.obs.auto_connect)
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

    /// Connect with the current settings, start reading events and load the lists.
    pub async fn connect(&self) -> Result<(), String> {
        *self.inner.manual_off.lock() = false;
        if self.inner.client.lock().await.is_some() {
            return Ok(());
        }
        let (host, port, password) = {
            let st = self.inner.settings.lock();
            let o = &st.settings.obs;
            (o.host.clone(), o.port, if o.password.is_empty() { None } else { Some(o.password.clone()) })
        };
        let result = tokio::time::timeout(Duration::from_secs(8), Client::connect(host.as_str(), port, password.as_deref())).await;
        match result {
            Ok(Ok(client)) => {
                let generation = self.inner.generation.fetch_add(1, Ordering::Relaxed) + 1;
                let events = client.events();
                *self.inner.client.lock().await = Some(client);
                tracing::info!(host, port, "OBS connected");
                self.set_state(|s| {
                    s.connected = true;
                    s.error = None;
                });
                match events {
                    Ok(stream) => {
                        let handle = self.clone();
                        tokio::spawn(async move { handle.pump_events(stream, generation).await });
                    }
                    Err(e) => tracing::warn!(error = %e, "OBS events are not available; state-linked colours will lag"),
                }
                if let Err(e) = self.refresh().await {
                    tracing::warn!(error = %e, "OBS lists could not be loaded");
                }
                Ok(())
            }
            Ok(Err(e)) => {
                let msg = e.to_string();
                tracing::warn!(host, port, error = %msg, "OBS connection failed");
                self.set_state(|s| {
                    s.connected = false;
                    s.error = Some(msg.clone());
                });
                Err(msg)
            }
            Err(_) => {
                let msg = format!("no answer from {host}:{port}");
                self.set_state(|s| {
                    s.connected = false;
                    s.error = Some(msg.clone());
                });
                Err(msg)
            }
        }
    }

    pub async fn disconnect(&self) {
        *self.inner.manual_off.lock() = true;
        self.inner.generation.fetch_add(1, Ordering::Relaxed);
        if let Some(mut client) = self.inner.client.lock().await.take() {
            client.disconnect().await;
        }
        self.set_state(|s| {
            s.connected = false;
            s.error = None;
        });
    }

    async fn pump_events(self, mut stream: obws::events::EventStream, generation: u64) {
        while let Some(event) = stream.next().await {
            if self.inner.generation.load(Ordering::Relaxed) != generation {
                return;
            }
            self.apply_event(event);
        }
        // The stream ends when OBS closes the connection (or quits).
        if self.inner.generation.load(Ordering::Relaxed) == generation {
            *self.inner.client.lock().await = None;
            tracing::warn!("OBS connection lost");
            self.set_state(|s| {
                s.connected = false;
                s.error = Some("connection closed".into());
            });
        }
    }

    fn apply_event(&self, event: Event) {
        match event {
            Event::CurrentProgramSceneChanged { id, .. } => self.set_state(|s| s.current_scene = Some(id.name)),
            Event::SceneItemEnableStateChanged { scene, item_id, enabled, .. } => {
                let source = self.inner.items.lock().get(&(scene.name.clone(), item_id as i64)).cloned();
                match source {
                    Some(source) => self.set_state(|s| {
                        let key = (scene.name, source);
                        s.visible.retain(|v| *v != key);
                        if enabled {
                            s.visible.push(key);
                        }
                    }),
                    None => self.schedule_refresh(),
                }
            }
            Event::InputMuteStateChanged { id, muted, .. } => self.set_state(|s| {
                s.muted.retain(|m| *m != id.name);
                if muted {
                    s.muted.push(id.name);
                }
            }),
            Event::StreamStateChanged { active, .. } => self.set_state(|s| s.streaming = active),
            Event::RecordStateChanged { active, .. } => self.set_state(|s| s.recording = active),
            Event::ReplayBufferStateChanged { active, .. } => self.set_state(|s| s.replay_buffer = active),
            Event::SceneListChanged { .. }
            | Event::SceneCreated { .. }
            | Event::SceneRemoved { .. }
            | Event::SceneNameChanged { .. }
            | Event::SceneItemCreated { .. }
            | Event::SceneItemRemoved { .. }
            | Event::InputCreated { .. }
            | Event::InputRemoved { .. }
            | Event::InputNameChanged { .. }
            | Event::CurrentSceneCollectionChanged { .. }
            | Event::SceneCollectionListChanged { .. } => self.schedule_refresh(),
            _ => {}
        }
    }

    /// Reload the lists once the current burst of events is over.
    fn schedule_refresh(&self) {
        if self.inner.refresh_pending.swap(true, Ordering::AcqRel) {
            return;
        }
        let handle = self.clone();
        tokio::spawn(async move {
            tokio::time::sleep(REFRESH_DEBOUNCE).await;
            handle.inner.refresh_pending.store(false, Ordering::Release);
            if let Err(e) = handle.refresh().await {
                tracing::debug!(error = %e, "OBS reload after event failed");
            }
        });
    }

    /// Reload collections, scenes, inputs, item visibility, mute and output states.
    pub async fn refresh(&self) -> Result<(), String> {
        let guard = self.inner.client.lock().await;
        let client = guard.as_ref().ok_or("OBS is not connected")?;
        let collections = client.scene_collections().list().await.map_err(err)?;
        let scenes = client.scenes().list().await.map_err(err)?;
        let inputs = client.inputs().list(None).await.map_err(err)?;
        let mut scene_names: Vec<String> = scenes.scenes.iter().map(|sc| sc.id.name.clone()).collect();
        scene_names.reverse(); // OBS lists bottom-up

        let mut visible: Vec<(String, String)> = Vec::new();
        let mut items: HashMap<(String, i64), String> = HashMap::new();
        for scene in &scene_names {
            let list = client.scene_items().list(scene.as_str().into()).await.map_err(err)?;
            for item in list {
                items.insert((scene.clone(), item.id), item.source_name.clone());
                if client.scene_items().enabled(scene.as_str().into(), item.id).await.unwrap_or(false) {
                    visible.push((scene.clone(), item.source_name));
                }
            }
        }
        let mut muted: Vec<String> = Vec::new();
        for input in &inputs {
            if client.inputs().muted(input.id.name.as_str().into()).await.unwrap_or(false) {
                muted.push(input.id.name.clone());
            }
        }
        let streaming = client.streaming().status().await.map(|s| s.active).unwrap_or(false);
        let recording = client.recording().status().await.map(|s| s.active).unwrap_or(false);
        // Errors when the replay buffer is disabled in OBS; that counts as off.
        let replay_buffer = client.replay_buffer().status().await.unwrap_or(false);
        drop(guard);

        *self.inner.items.lock() = items;
        self.set_state(|s| {
            s.current_collection = Some(collections.current.clone());
            s.collections = collections.collections.clone();
            s.current_scene = scenes.current_program_scene.as_ref().map(|c| c.name.clone());
            s.scenes = scene_names;
            s.inputs = inputs.iter().map(|i| i.id.name.clone()).collect();
            s.visible = visible;
            s.muted = muted;
            s.streaming = streaming;
            s.recording = recording;
            s.replay_buffer = replay_buffer;
        });
        Ok(())
    }

    pub async fn filters(&self, source: &str) -> Result<Vec<String>, String> {
        let guard = self.inner.client.lock().await;
        let client = guard.as_ref().ok_or("OBS is not connected")?;
        let list = client.filters().list(source.into()).await.map_err(err)?;
        Ok(list.into_iter().map(|f| f.name).collect())
    }

    async fn with_client<T>(&self, f: impl AsyncFnOnce(&Client) -> obws::error::Result<T>) -> Result<T, String> {
        let guard = self.inner.client.lock().await;
        let client = guard.as_ref().ok_or("OBS is not connected")?;
        match f(client).await {
            Ok(v) => Ok(v),
            Err(e) => {
                let msg = e.to_string();
                if is_connection_error(&e) {
                    drop(guard);
                    self.inner.generation.fetch_add(1, Ordering::Relaxed);
                    *self.inner.client.lock().await = None;
                    self.set_state(|s| {
                        s.connected = false;
                        s.error = Some(msg.clone());
                    });
                }
                Err(msg)
            }
        }
    }

    async fn ensure_collection(&self, collection: Option<&str>) -> Result<(), String> {
        let Some(wanted) = collection else { return Ok(()) };
        let current = self.inner.state.lock().current_collection.clone();
        if current.as_deref() == Some(wanted) {
            return Ok(());
        }
        self.with_client(async |c| c.scene_collections().set_current(wanted).await).await?;
        // Switching collections replaces every scene; give OBS a moment, then reload.
        tokio::time::sleep(Duration::from_millis(400)).await;
        let _ = self.refresh().await;
        Ok(())
    }

    pub async fn switch_scene(&self, collection: Option<&str>, scene: &str) -> Result<(), String> {
        self.ensure_collection(collection).await?;
        self.with_client(async |c| c.scenes().set_current_program_scene(scene).await).await
    }

    /// Show, hide (`Some`) or flip (`None`) every item of `source` in `scene`.
    pub async fn set_source_visible(&self, collection: Option<&str>, scene: &str, source: &str, visible: Option<bool>) -> Result<(), String> {
        self.ensure_collection(collection).await?;
        self.with_client(async |c| {
            let items = c.scene_items().list(scene.into()).await?;
            for item in items.into_iter().filter(|i| i.source_name == source) {
                let enabled = match visible {
                    Some(v) => v,
                    None => !c.scene_items().enabled(scene.into(), item.id).await?,
                };
                c.scene_items()
                    .set_enabled(obws::requests::scene_items::SetEnabled { scene: scene.into(), item_id: item.id, enabled })
                    .await?;
            }
            Ok(())
        })
        .await
    }

    /// Mute and set the volume: dB, or percent as OBS shows it in the advanced
    /// audio properties (100 % = 0 dB, the multiplier scale).
    pub async fn set_audio(&self, source: &str, mute: MuteMode, volume: Option<(f32, VolumeUnit)>) -> Result<(), String> {
        let volume = volume.map(|(level, unit)| match unit {
            VolumeUnit::Db => Volume::Db(level.clamp(-100.0, 26.0)),
            VolumeUnit::Percent => Volume::Mul((level / 100.0).clamp(0.0, 20.0)),
        });
        self.with_client(async |c| {
            let muted = match mute {
                MuteMode::Mute => Some(true),
                MuteMode::Unmute => Some(false),
                MuteMode::Toggle => Some(!c.inputs().muted(source.into()).await?),
                MuteMode::Keep => None,
            };
            if let Some(muted) = muted {
                c.inputs().set_muted(source.into(), muted).await?;
            }
            if let Some(volume) = volume {
                c.inputs().set_volume(source.into(), volume).await?;
            }
            Ok(())
        })
        .await
    }

    pub async fn set_filter(&self, source: &str, filter: &str, enabled: bool) -> Result<(), String> {
        self.with_client(async |c| c.filters().set_enabled(obws::requests::filters::SetEnabled { source: source.into(), filter, enabled }).await)
            .await
    }

    pub async fn output(&self, target: ObsTarget, mode: ObsMode) -> Result<(), String> {
        self.with_client(async |c| {
            match (target, mode) {
                (ObsTarget::Stream, ObsMode::Start) => c.streaming().start().await,
                (ObsTarget::Stream, ObsMode::Stop) => c.streaming().stop().await,
                (ObsTarget::Stream, ObsMode::Toggle) => c.streaming().toggle().await.map(|_| ()),
                (ObsTarget::Record, ObsMode::Start) => c.recording().start().await,
                (ObsTarget::Record, ObsMode::Stop) => c.recording().stop().await.map(|_| ()),
                (ObsTarget::Record, ObsMode::Toggle) => c.recording().toggle().await.map(|_| ()),
                (ObsTarget::Replay, ObsMode::Start) => c.replay_buffer().start().await,
                (ObsTarget::Replay, ObsMode::Stop) => c.replay_buffer().stop().await,
                (ObsTarget::Replay, ObsMode::Toggle) => c.replay_buffer().toggle().await.map(|_| ()),
            }
        })
        .await
    }

    /// Every hotkey name OBS knows (`OBSBasic.StartStreaming`, `libobs.mute`, …), each once: OBS
    /// repeats the per-source ones for every source that has them.
    pub async fn hotkeys(&self) -> Result<Vec<String>, String> {
        let list = self.with_client(async |c| c.hotkeys().list().await).await?;
        let mut seen = std::collections::HashSet::new();
        Ok(list.into_iter().filter(|name| seen.insert(name.clone())).collect())
    }

    /// Fires a hotkey by its name; `context` names the source for per-source hotkeys such as `libobs.mute`.
    pub async fn trigger_hotkey(&self, name: &str, context: Option<&str>) -> Result<(), String> {
        self.with_client(async |c| c.hotkeys().trigger_by_name(name, context).await).await
    }

    /// Fires whatever is bound to a key combination, as if it had been pressed in OBS.
    pub async fn trigger_key_sequence(&self, key: &str, shift: bool, control: bool, alt: bool, command: bool) -> Result<(), String> {
        let modifiers = obws::requests::hotkeys::KeyModifiers { shift, control, alt, command };
        self.with_client(async |c| c.hotkeys().trigger_by_sequence(key, modifiers).await).await
    }

    pub async fn save_replay(&self) -> Result<(), String> {
        self.with_client(async |c| c.replay_buffer().save().await).await
    }

    pub async fn studio_mode(&self, mode: StudioMode) -> Result<(), String> {
        self.with_client(async |c| {
            let on = c.ui().studio_mode_enabled().await?;
            match (mode, on) {
                (StudioMode::Enable, true) | (StudioMode::Disable, false) => Ok(()),
                (StudioMode::Enable, false) | (StudioMode::Toggle, false) => c.ui().set_studio_mode_enabled(true).await,
                (StudioMode::Disable, true) | (StudioMode::Toggle, true) => c.ui().set_studio_mode_enabled(false).await,
                (StudioMode::Transition, true) => c.transitions().trigger().await,
                (StudioMode::Transition, false) => Ok(()),
            }
        })
        .await
    }
}

fn err(e: obws::error::Error) -> String {
    e.to_string()
}

fn is_connection_error(e: &obws::error::Error) -> bool {
    let s = e.to_string().to_lowercase();
    s.contains("disconnect") || s.contains("connection") || s.contains("closed") || s.contains("timeout")
}
