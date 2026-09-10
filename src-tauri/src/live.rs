//! Live state of the streaming integrations that button colours can follow.
//! A button with a [`StateLink`] shows its active colour while the linked
//! condition holds (its scene is live, its source is visible, the stream is
//! on, …). The integrations write here; the LED renderer and the window read.

use crate::profile::{LinkKind, LinkProvider, StateLink};
use parking_lot::Mutex;
use std::collections::HashSet;
use std::sync::Arc;

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ProviderStatus {
    pub connected: bool,
    pub current_scene: Option<String>,
    /// `(scene, source)` pairs whose item is visible
    pub visible: HashSet<(String, String)>,
    pub muted: HashSet<String>,
    pub streaming: bool,
    pub recording: bool,
    pub replay_buffer: bool,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct LiveStatus {
    pub obs: ProviderStatus,
    pub slobs: ProviderStatus,
}

pub type SharedLive = Arc<Mutex<LiveStatus>>;

/// Writer handle for the integrations; `on_change` runs after a real change
/// (the app repaints the LEDs with it).
#[derive(Clone)]
pub struct LiveHandle {
    status: SharedLive,
    on_change: Arc<dyn Fn() + Send + Sync>,
}

impl LiveHandle {
    pub fn new(status: SharedLive, on_change: Arc<dyn Fn() + Send + Sync>) -> Self {
        LiveHandle { status, on_change }
    }

    pub fn update(&self, provider: LinkProvider, f: impl FnOnce(&mut ProviderStatus)) {
        let changed = {
            let mut st = self.status.lock();
            let slot = match provider {
                LinkProvider::Obs => &mut st.obs,
                LinkProvider::Slobs => &mut st.slobs,
            };
            let before = slot.clone();
            f(slot);
            *slot != before
        };
        if changed {
            (self.on_change)();
        }
    }
}

impl StateLink {
    pub fn is_active(&self, live: &LiveStatus) -> bool {
        let p = match self.provider {
            LinkProvider::Obs => &live.obs,
            LinkProvider::Slobs => &live.slobs,
        };
        if !p.connected {
            return false;
        }
        match self.kind {
            LinkKind::Scene => p.current_scene.as_deref() == Some(self.scene.as_str()),
            LinkKind::SourceVisible => {
                let scene = if self.scene.is_empty() { p.current_scene.clone() } else { Some(self.scene.clone()) };
                scene.map(|s| p.visible.contains(&(s, self.source.clone()))).unwrap_or(false)
            }
            LinkKind::SourceMuted => p.muted.contains(&self.source),
            LinkKind::Streaming => p.streaming,
            LinkKind::Recording => p.recording,
            LinkKind::ReplayBuffer => p.replay_buffer,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn link(provider: LinkProvider, kind: LinkKind, scene: &str, source: &str) -> StateLink {
        StateLink { provider, kind, scene: scene.into(), source: source.into() }
    }

    #[test]
    fn links_follow_the_status() {
        let mut live = LiveStatus::default();
        live.obs.connected = true;
        live.obs.current_scene = Some("Game".into());
        live.obs.visible.insert(("Game".into(), "Cam".into()));
        live.obs.muted.insert("Mic".into());
        live.obs.streaming = true;

        assert!(link(LinkProvider::Obs, LinkKind::Scene, "Game", "").is_active(&live));
        assert!(!link(LinkProvider::Obs, LinkKind::Scene, "Chat", "").is_active(&live));
        assert!(link(LinkProvider::Obs, LinkKind::SourceVisible, "Game", "Cam").is_active(&live));
        // Empty scene = the current scene.
        assert!(link(LinkProvider::Obs, LinkKind::SourceVisible, "", "Cam").is_active(&live));
        assert!(!link(LinkProvider::Obs, LinkKind::SourceVisible, "Chat", "Cam").is_active(&live));
        assert!(link(LinkProvider::Obs, LinkKind::SourceMuted, "", "Mic").is_active(&live));
        assert!(link(LinkProvider::Obs, LinkKind::Streaming, "", "").is_active(&live));
        assert!(!link(LinkProvider::Obs, LinkKind::Recording, "", "").is_active(&live));
        // Streamlabs is not connected: nothing lights up.
        assert!(!link(LinkProvider::Slobs, LinkKind::Streaming, "", "").is_active(&live));
    }

    #[test]
    fn disconnected_provider_is_inactive() {
        let mut live = LiveStatus::default();
        live.obs.streaming = true;
        assert!(!link(LinkProvider::Obs, LinkKind::Streaming, "", "").is_active(&live));
        let handle = LiveHandle::new(Arc::new(Mutex::new(live)), Arc::new(|| {}));
        handle.update(LinkProvider::Obs, |p| p.connected = true);
        assert!(link(LinkProvider::Obs, LinkKind::Streaming, "", "").is_active(&handle.status.lock()));
    }
}
