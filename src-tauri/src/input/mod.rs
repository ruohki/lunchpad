//! Keyboard synthesis. A dedicated thread owns the `enigo` connection (it is
//! created lazily on first use, which on macOS triggers the Accessibility
//! permission prompt) and executes key commands sent over a channel.

pub mod keys;

use crossbeam_channel::{unbounded, Sender};
use enigo::{Direction, Enigo, Keyboard, Mouse, Settings};
use keys::{parse_key, parse_modifier, parse_mouse};
use serde::Serialize;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

pub const EVENT_INPUT_UNAVAILABLE: &str = "input:unavailable";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InputUnavailable {
    pub reason: String,
    pub needs_permission: bool,
}

enum Cmd {
    Hold { key: String, modifiers: Vec<String> },
    Release { key: String, modifiers: Vec<String> },
    Tap { key: String, modifiers: Vec<String> },
    /// Type a string as-is (unicode aware).
    Text(String),
    /// Create the connection now (used by "check permission" in settings).
    Probe,
}

#[derive(Clone)]
pub struct KeyboardHandle {
    tx: Sender<Cmd>,
}

impl KeyboardHandle {
    pub fn hold(&self, key: &str, modifiers: &[String]) {
        let _ = self.tx.send(Cmd::Hold { key: key.into(), modifiers: modifiers.to_vec() });
    }
    pub fn release(&self, key: &str, modifiers: &[String]) {
        let _ = self.tx.send(Cmd::Release { key: key.into(), modifiers: modifiers.to_vec() });
    }
    pub fn tap(&self, key: &str, modifiers: &[String]) {
        let _ = self.tx.send(Cmd::Tap { key: key.into(), modifiers: modifiers.to_vec() });
    }
    pub fn text(&self, text: &str) {
        let _ = self.tx.send(Cmd::Text(text.into()));
    }
    pub fn probe(&self) {
        let _ = self.tx.send(Cmd::Probe);
    }
}

struct Worker {
    app: Option<AppHandle>,
    enigo: Option<Enigo>,
    reported: bool,
}

impl Worker {
    fn connection(&mut self) -> Option<&mut Enigo> {
        if self.enigo.is_none() {
            let settings = Settings { open_prompt_to_get_permissions: true, ..Default::default() };
            match Enigo::new(&settings) {
                Ok(e) => {
                    tracing::info!("keyboard synthesis ready");
                    self.enigo = Some(e);
                    self.reported = false;
                }
                Err(e) => {
                    let needs_permission = matches!(e, enigo::NewConError::NoPermission);
                    tracing::warn!(error = %e, "keyboard synthesis unavailable");
                    if !self.reported {
                        self.reported = true;
                        if let Some(app) = &self.app {
                            let _ = app.emit(EVENT_INPUT_UNAVAILABLE, InputUnavailable { reason: e.to_string(), needs_permission });
                        }
                    }
                    return None;
                }
            }
        }
        self.enigo.as_mut()
    }

    fn combo(&mut self, key: &str, modifiers: &[String], direction: Direction) {
        // A "key" may also be a mouse button (push-to-talk on a side button).
        let mouse = parse_mouse(key);
        let main = match (mouse, parse_key(key)) {
            (Some(_), _) => None,
            (None, Some(k)) => Some(k),
            (None, None) => {
                tracing::warn!(key, "unknown key name");
                return;
            }
        };
        let mods: Vec<_> = modifiers.iter().filter_map(|m| parse_modifier(m)).collect();
        let Some(enigo) = self.connection() else { return };
        let act = |enigo: &mut Enigo, direction: Direction| match (mouse, main) {
            (Some(button), _) => enigo.button(button, direction),
            (None, Some(k)) => enigo.key(k, direction),
            (None, None) => Ok(()),
        };
        let result = match direction {
            Direction::Press | Direction::Click => {
                let mut r = Ok(());
                for m in &mods {
                    r = r.and(enigo.key(*m, Direction::Press));
                }
                r = r.and(act(enigo, direction));
                if direction == Direction::Click {
                    for m in mods.iter().rev() {
                        r = r.and(enigo.key(*m, Direction::Release));
                    }
                }
                r
            }
            Direction::Release => {
                let mut r = act(enigo, Direction::Release);
                for m in mods.iter().rev() {
                    r = r.and(enigo.key(*m, Direction::Release));
                }
                r
            }
        };
        if let Err(e) = result {
            tracing::warn!(error = %e, key, "key synthesis failed");
            // Force a reconnect next time; the permission may have changed.
            self.enigo = None;
        }
    }
}

/// Start the keyboard thread. `app` is used to report a missing permission.
pub fn spawn_keyboard(app: Option<AppHandle>) -> KeyboardHandle {
    let (tx, rx) = unbounded::<Cmd>();
    std::thread::Builder::new()
        .name("lunchpad-keyboard".into())
        .spawn(move || {
            let mut worker = Worker { app, enigo: None, reported: false };
            while let Ok(cmd) = rx.recv() {
                match cmd {
                    Cmd::Hold { key, modifiers } => worker.combo(&key, &modifiers, Direction::Press),
                    Cmd::Release { key, modifiers } => worker.combo(&key, &modifiers, Direction::Release),
                    Cmd::Tap { key, modifiers } => worker.combo(&key, &modifiers, Direction::Click),
                    Cmd::Text(text) => {
                        if let Some(enigo) = worker.connection() {
                            if let Err(e) = enigo.text(&text) {
                                tracing::warn!(error = %e, "typing text failed");
                                worker.enigo = None;
                            }
                        }
                    }
                    Cmd::Probe => {
                        worker.reported = false;
                        let _ = worker.connection();
                    }
                }
            }
        })
        .expect("failed to spawn keyboard thread");
    KeyboardHandle { tx }
}

pub type SharedKeyboard = Arc<KeyboardHandle>;
