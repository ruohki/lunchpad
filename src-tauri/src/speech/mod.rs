//! Text to speech through the operating system's voices (`tts` crate). A
//! dedicated thread owns the engine; utterances are spoken one after another.

use crossbeam_channel::{unbounded, Sender, TryRecvError};
use serde::Serialize;
use std::time::Duration;
use tokio::sync::oneshot;
use tts::Tts;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceInfo {
    pub id: String,
    pub name: String,
    pub language: String,
}

pub struct SpeakRequest {
    pub text: String,
    /// Voice id (or name) from [`SpeechHandle::voices`]; `None` = system default
    pub voice: Option<String>,
    /// 0.0..1.0
    pub volume: f32,
}

enum Cmd {
    Speak { req: SpeakRequest, done: oneshot::Sender<Result<(), String>> },
    Stop,
    Voices(oneshot::Sender<Vec<VoiceInfo>>),
}

#[derive(Clone)]
pub struct SpeechHandle {
    tx: Sender<Cmd>,
}

impl SpeechHandle {
    pub fn speak(&self, req: SpeakRequest) -> oneshot::Receiver<Result<(), String>> {
        let (tx, rx) = oneshot::channel();
        if self.tx.send(Cmd::Speak { req, done: tx }).is_err() {
            let (t, r) = oneshot::channel();
            let _ = t.send(Err("speech thread is gone".into()));
            return r;
        }
        rx
    }
    pub fn stop(&self) {
        let _ = self.tx.send(Cmd::Stop);
    }
    pub async fn voices(&self) -> Vec<VoiceInfo> {
        let (tx, rx) = oneshot::channel();
        let _ = self.tx.send(Cmd::Voices(tx));
        rx.await.unwrap_or_default()
    }
}

struct Worker {
    tts: Option<Tts>,
}

impl Worker {
    fn engine(&mut self) -> Result<&mut Tts, String> {
        if self.tts.is_none() {
            let tts = Tts::default().map_err(|e| format!("text to speech is not available: {e}"))?;
            tracing::info!(features = %tts.supported_features(), "text to speech ready");
            self.tts = Some(tts);
        }
        Ok(self.tts.as_mut().expect("just created"))
    }

    fn voices(&mut self) -> Vec<VoiceInfo> {
        let Ok(tts) = self.engine() else { return Vec::new() };
        tts.voices()
            .map(|vs| {
                vs.into_iter()
                    .map(|v| VoiceInfo { id: v.id(), name: v.name(), language: v.language().to_string() })
                    .collect()
            })
            .unwrap_or_default()
    }

    fn speak(&mut self, req: SpeakRequest, rx: &crossbeam_channel::Receiver<Cmd>) -> Result<(), String> {
        let tts = self.engine()?;
        let features = tts.supported_features();
        if let Some(wanted) = req.voice.as_deref().filter(|v| !v.is_empty()) {
            if features.voice {
                if let Ok(voices) = tts.voices() {
                    if let Some(v) = voices.iter().find(|v| v.id() == wanted || v.name() == wanted) {
                        let _ = tts.set_voice(v);
                    } else {
                        tracing::warn!(voice = wanted, "voice not found, using the default voice");
                    }
                }
            }
        }
        if features.volume {
            let (min, max) = (tts.min_volume(), tts.max_volume());
            let _ = tts.set_volume(min + (max - min) * req.volume.clamp(0.0, 1.0));
        }
        tts.speak(req.text, true).map_err(|e| e.to_string())?;
        // Wait until the utterance ends, unless a Stop arrives meanwhile.
        loop {
            std::thread::sleep(Duration::from_millis(60));
            match rx.try_recv() {
                Ok(Cmd::Stop) => {
                    let _ = tts.stop();
                    return Ok(());
                }
                Ok(Cmd::Voices(reply)) => {
                    let _ = reply.send(Vec::new());
                }
                Ok(Cmd::Speak { done, .. }) => {
                    let _ = done.send(Err("already speaking".into()));
                }
                Err(TryRecvError::Disconnected) => return Ok(()),
                Err(TryRecvError::Empty) => {}
            }
            if !features.is_speaking || !tts.is_speaking().unwrap_or(false) {
                return Ok(());
            }
        }
    }
}

pub fn spawn_speech() -> SpeechHandle {
    let (tx, rx) = unbounded::<Cmd>();
    std::thread::Builder::new()
        .name("lunchpad-speech".into())
        .spawn(move || {
            let mut worker = Worker { tts: None };
            while let Ok(cmd) = rx.recv() {
                match cmd {
                    Cmd::Speak { req, done } => {
                        let result = worker.speak(req, &rx);
                        let _ = done.send(result);
                    }
                    Cmd::Stop => {
                        if let Some(tts) = worker.tts.as_mut() {
                            let _ = tts.stop();
                        }
                    }
                    Cmd::Voices(reply) => {
                        let _ = reply.send(worker.voices());
                    }
                }
            }
        })
        .expect("failed to spawn speech thread");
    SpeechHandle { tx }
}
