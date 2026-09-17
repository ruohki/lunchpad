//! Keyboard and mouse synthesis. A dedicated thread owns the `enigo` connection (it is
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
    MouseMove {
        x: i32,
        y: i32,
        relative: bool,
    },
    MouseButton {
        button: enigo::Button,
        direction: Direction,
    },
    MouseScroll {
        amount: i32,
        horizontal: bool,
    },
    /// Where the pointer is, answered on the channel.
    MouseLocation(Sender<Option<(i32, i32)>>),
}

/// A mouse button as the actions name it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub enum MouseButton {
    #[default]
    Left,
    Right,
    Middle,
}

impl From<MouseButton> for enigo::Button {
    fn from(b: MouseButton) -> Self {
        match b {
            MouseButton::Left => enigo::Button::Left,
            MouseButton::Right => enigo::Button::Right,
            MouseButton::Middle => enigo::Button::Middle,
        }
    }
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
    /// Move the pointer to a screen position, or by an offset.
    pub fn mouse_move(&self, x: i32, y: i32, relative: bool) {
        let _ = self.tx.send(Cmd::MouseMove { x, y, relative });
    }
    pub fn mouse_button(&self, button: MouseButton, direction: Direction) {
        let _ = self.tx.send(Cmd::MouseButton {
            button: button.into(),
            direction,
        });
    }
    /// Scroll by `amount` notches: positive is down, or right for the horizontal axis.
    pub fn mouse_scroll(&self, amount: i32, horizontal: bool) {
        let _ = self.tx.send(Cmd::MouseScroll { amount, horizontal });
    }
    /// The pointer's screen position, `None` when the input connection is unavailable.
    pub fn mouse_location(&self) -> Option<(i32, i32)> {
        let (tx, rx) = crossbeam_channel::bounded(1);
        self.tx.send(Cmd::MouseLocation(tx)).ok()?;
        rx.recv_timeout(std::time::Duration::from_secs(2))
            .ok()
            .flatten()
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
                    Cmd::MouseMove { x, y, relative } => {
                        if let Some(enigo) = worker.connection() {
                            let coordinate = if relative {
                                enigo::Coordinate::Rel
                            } else {
                                enigo::Coordinate::Abs
                            };
                            if let Err(e) = enigo.move_mouse(x, y, coordinate) {
                                tracing::warn!(error = %e, "moving the mouse failed");
                                worker.enigo = None;
                            }
                        }
                    }
                    Cmd::MouseButton { button, direction } => {
                        if let Some(enigo) = worker.connection() {
                            if let Err(e) = enigo.button(button, direction) {
                                tracing::warn!(error = %e, "mouse button failed");
                                worker.enigo = None;
                            }
                        }
                    }
                    Cmd::MouseScroll { amount, horizontal } => {
                        if let Some(enigo) = worker.connection() {
                            let axis = if horizontal {
                                enigo::Axis::Horizontal
                            } else {
                                enigo::Axis::Vertical
                            };
                            if let Err(e) = enigo.scroll(amount, axis) {
                                tracing::warn!(error = %e, "scrolling failed");
                                worker.enigo = None;
                            }
                        }
                    }
                    Cmd::MouseLocation(reply) => {
                        let at = worker.connection().and_then(|enigo| enigo.location().ok());
                        let _ = reply.send(at);
                    }
                }
            }
        })
        .expect("failed to spawn keyboard thread");
    KeyboardHandle { tx }
}

pub type SharedKeyboard = Arc<KeyboardHandle>;
