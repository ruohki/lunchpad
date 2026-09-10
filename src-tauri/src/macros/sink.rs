//! Outputs of the macro engine. The Tauri app implements this to emit events
//! and repaint LEDs; tests use a recording implementation.

use super::engine::RunningMacro;
use crate::profile::Profile;

pub trait EngineSink: Send + Sync + 'static {
    /// The set of running macros changed.
    fn running_changed(&self, running: &[RunningMacro]);
    /// An action changed the profile (colour, active page, flip-flop state).
    fn profile_changed(&self, profile: &Profile);
    /// LEDs should be repainted.
    fn repaint(&self);
    /// Hold or release the push-to-talk key.
    fn push_to_talk(&self, held: bool) {
        let _ = held;
    }
    /// Whether push-to-talk sections should run at all (legacy skipped them
    /// when the feature was disabled in settings).
    fn push_to_talk_enabled(&self) -> bool {
        true
    }
    /// The global variables changed.
    fn variables_changed(&self, globals: &std::collections::HashMap<String, String>) {
        let _ = globals;
    }
}

/// Sink that does nothing; handy for tests and headless runs.
pub struct NullSink;
impl EngineSink for NullSink {
    fn running_changed(&self, _: &[RunningMacro]) {}
    fn profile_changed(&self, _: &Profile) {}
    fn repaint(&self) {}
}
