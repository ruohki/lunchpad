//! Sound playback. A dedicated thread owns one output stream per audio
//! device and a sink per playing sound, so any number of sounds can overlap
//! on any mix of devices. Callers get a receiver that resolves when the sound
//! finished (or failed) and can stop a sound by id.

pub mod peaks;

use crossbeam_channel::{unbounded, RecvTimeoutError, Sender};
use rodio::cpal::traits::{DeviceTrait, HostTrait};
use rodio::{Decoder, OutputStream, OutputStreamBuilder, Sink, Source};
use serde::Serialize;
use std::collections::HashMap;
use std::fs::File;
use std::io::BufReader;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::oneshot;

#[derive(Debug, Clone)]
pub struct PlayRequest {
    pub file: PathBuf,
    /// Output device name; `None` = system default device
    pub device: Option<String>,
    /// 1.0 = 100 %
    pub volume: f32,
    /// Trim, fractions of the file length
    pub start: f32,
    pub end: f32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioDevices {
    pub default: Option<String>,
    pub devices: Vec<String>,
}

pub type PlayId = u64;
pub type PlayResult = Result<(), String>;

enum Cmd {
    Play { id: PlayId, req: PlayRequest, done: oneshot::Sender<PlayResult> },
    Stop(PlayId),
    StopAll,
    Devices(oneshot::Sender<AudioDevices>),
}

#[derive(Clone)]
pub struct AudioHandle {
    tx: Sender<Cmd>,
    next_id: Arc<AtomicU64>,
}

impl AudioHandle {
    pub fn play(&self, req: PlayRequest) -> (PlayId, oneshot::Receiver<PlayResult>) {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let (done_tx, done_rx) = oneshot::channel();
        if self.tx.send(Cmd::Play { id, req, done: done_tx }).is_err() {
            let (tx, rx) = oneshot::channel();
            let _ = tx.send(Err("audio thread is gone".into()));
            return (id, rx);
        }
        (id, done_rx)
    }

    pub fn stop(&self, id: PlayId) {
        let _ = self.tx.send(Cmd::Stop(id));
    }

    pub fn stop_all(&self) {
        let _ = self.tx.send(Cmd::StopAll);
    }

    pub async fn devices(&self) -> AudioDevices {
        let (tx, rx) = oneshot::channel();
        let _ = self.tx.send(Cmd::Devices(tx));
        rx.await.unwrap_or(AudioDevices { default: None, devices: Vec::new() })
    }
}

struct Playing {
    sink: Sink,
    done: Option<oneshot::Sender<PlayResult>>,
    /// Safety net in case the device vanishes and the sink never drains.
    deadline: Option<Instant>,
}

struct Worker {
    streams: HashMap<String, OutputStream>,
    playing: HashMap<PlayId, Playing>,
}

const DEFAULT_KEY: &str = "\u{0}default";

impl Worker {
    fn list_devices() -> AudioDevices {
        let host = rodio::cpal::default_host();
        let default = host.default_output_device().and_then(|d| d.name().ok());
        let devices = host
            .output_devices()
            .map(|it| it.filter_map(|d| d.name().ok()).collect())
            .unwrap_or_default();
        AudioDevices { default, devices }
    }

    fn stream_for(&mut self, device: &Option<String>) -> Result<&OutputStream, String> {
        let key = device.clone().unwrap_or_else(|| DEFAULT_KEY.to_string());
        if !self.streams.contains_key(&key) {
            let host = rodio::cpal::default_host();
            let builder = match device {
                Some(name) => {
                    let found = host
                        .output_devices()
                        .map_err(|e| e.to_string())?
                        .find(|d| d.name().map(|n| &n == name).unwrap_or(false));
                    match found {
                        Some(d) => OutputStreamBuilder::from_device(d),
                        None => {
                            tracing::warn!(device = %name, "audio device not found, using the default device");
                            OutputStreamBuilder::from_default_device()
                        }
                    }
                }
                None => OutputStreamBuilder::from_default_device(),
            }
            .map_err(|e| format!("could not open audio device: {e}"))?;
            let mut stream = builder.open_stream_or_fallback().map_err(|e| format!("could not start audio stream: {e}"))?;
            stream.log_on_drop(false);
            tracing::info!(device = device.as_deref().unwrap_or("default"), "audio stream opened");
            self.streams.insert(key.clone(), stream);
        }
        Ok(self.streams.get(&key).expect("just inserted"))
    }

    fn play(&mut self, id: PlayId, req: PlayRequest, done: oneshot::Sender<PlayResult>) {
        match self.start(&req) {
            Ok((sink, deadline)) => {
                self.playing.insert(id, Playing { sink, done: Some(done), deadline });
            }
            Err(e) => {
                tracing::warn!(file = %req.file.display(), error = %e, "could not play sound");
                let _ = done.send(Err(e));
            }
        }
    }

    fn start(&mut self, req: &PlayRequest) -> Result<(Sink, Option<Instant>), String> {
        let file = File::open(&req.file).map_err(|e| format!("could not open {}: {e}", req.file.display()))?;
        let len = file.metadata().map(|m| m.len()).ok();
        let mut builder = Decoder::builder().with_data(BufReader::new(file)).with_seekable(true);
        if let Some(len) = len {
            builder = builder.with_byte_len(len);
        }
        let source = builder.build().map_err(|e| format!("could not decode {}: {e}", req.file.display()))?;
        let total = source.total_duration();

        let start = req.start.clamp(0.0, 1.0);
        let end = req.end.clamp(start, 1.0);
        let trimmed = total.map(|t| (t.mul_f32(start), t.mul_f32(end - start)));
        let stream = self.stream_for(&req.device)?;
        let sink = Sink::connect_new(stream.mixer());
        sink.set_volume(req.volume.max(0.0));
        let deadline = match trimmed {
            Some((skip, keep)) => {
                sink.append(source.skip_duration(skip).take_duration(keep));
                Some(Instant::now() + keep + Duration::from_secs(2))
            }
            None => {
                sink.append(source);
                None
            }
        };
        Ok((sink, deadline))
    }

    fn tick(&mut self) {
        let now = Instant::now();
        let finished: Vec<PlayId> = self
            .playing
            .iter()
            .filter(|(_, p)| p.sink.empty() || p.deadline.map(|d| now > d).unwrap_or(false))
            .map(|(id, _)| *id)
            .collect();
        for id in finished {
            if let Some(mut p) = self.playing.remove(&id) {
                if let Some(done) = p.done.take() {
                    let _ = done.send(Ok(()));
                }
            }
        }
    }

    fn stop(&mut self, id: PlayId) {
        if let Some(mut p) = self.playing.remove(&id) {
            p.sink.stop();
            if let Some(done) = p.done.take() {
                let _ = done.send(Ok(()));
            }
        }
    }

    fn stop_all(&mut self) {
        let ids: Vec<PlayId> = self.playing.keys().copied().collect();
        for id in ids {
            self.stop(id);
        }
    }
}

pub fn spawn_audio() -> AudioHandle {
    let (tx, rx) = unbounded::<Cmd>();
    std::thread::Builder::new()
        .name("lunchpad-audio".into())
        .spawn(move || {
            let mut worker = Worker { streams: HashMap::new(), playing: HashMap::new() };
            loop {
                match rx.recv_timeout(Duration::from_millis(40)) {
                    Ok(Cmd::Play { id, req, done }) => worker.play(id, req, done),
                    Ok(Cmd::Stop(id)) => worker.stop(id),
                    Ok(Cmd::StopAll) => worker.stop_all(),
                    Ok(Cmd::Devices(reply)) => {
                        let _ = reply.send(Worker::list_devices());
                    }
                    Err(RecvTimeoutError::Timeout) => {}
                    Err(RecvTimeoutError::Disconnected) => break,
                }
                worker.tick();
            }
        })
        .expect("failed to spawn audio thread");
    AudioHandle { tx, next_id: Arc::new(AtomicU64::new(1)) }
}
