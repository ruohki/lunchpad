//! Tauri command layer: thin wrappers between the frontend and the core.

pub mod device;
pub mod diagnostics;
pub mod macros;
pub mod media;
pub mod profile;
pub mod settings;

use crate::audio::AudioHandle;
use crate::config::SharedSettings;
use crate::input::SharedKeyboard;
use crate::macros::MacroEngine;
use crate::midi::SharedManager;
use crate::obs::ObsHandle;
use crate::profile::ProfileStore;
use crate::slobs::SlobsHandle;
use crate::speech::SpeechHandle;
use parking_lot::Mutex;
use std::sync::Arc;

pub struct AppState {
    pub manager: SharedManager,
    pub profile: Arc<Mutex<ProfileStore>>,
    pub settings: SharedSettings,
    pub engine: MacroEngine,
    pub keyboard: SharedKeyboard,
    pub audio: AudioHandle,
    pub speech: SpeechHandle,
    pub obs: ObsHandle,
    pub slobs: SlobsHandle,
    /// Profiles before each edit made from the UI, newest last (undo).
    pub history: Mutex<Vec<crate::profile::Profile>>,
    /// Profiles undone, newest last (redo); cleared by the next edit.
    pub redo: Mutex<Vec<crate::profile::Profile>>,
}

pub type CmdResult<T> = Result<T, String>;

pub fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

pub use device::*;
pub use diagnostics::*;
pub use macros::*;
pub use media::*;
pub use profile::*;
pub use settings::*;
