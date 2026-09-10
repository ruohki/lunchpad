//! Outside services the engine can use. Every field is optional so the engine
//! runs (and is tested) without hardware, audio, OBS or Streamlabs.

use crate::audio::AudioHandle;
use crate::config::SharedSettings;
use crate::input::KeyboardHandle;
use crate::obs::ObsHandle;
use crate::slobs::SlobsHandle;
use crate::speech::SpeechHandle;

#[derive(Clone, Default)]
pub struct Services {
    pub audio: Option<AudioHandle>,
    pub keyboard: Option<KeyboardHandle>,
    pub speech: Option<SpeechHandle>,
    pub obs: Option<ObsHandle>,
    pub slobs: Option<SlobsHandle>,
    pub settings: Option<SharedSettings>,
}
