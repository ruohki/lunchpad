//! The macro engine: turns button presses into running action lists.
//!
//! Semantics (carried over from the legacy app, see docs/LEGACY_INVENTORY.md):
//! * one runner per press (down list) and per release (up list);
//! * actions run in order; an action with `wait = false` runs concurrently
//!   and is joined at the end of the pass;
//! * `loop` repeats the down list until the runner is stopped;
//! * pressing a running button starts another runner; StopThisMacro cancels
//!   every runner at that pad, RestartThisMacro cancels the others;
//! * FlipFlop markers alternate between two branches, persisted in the profile;
//! * push-to-talk is a reference counter shared by all runners.
//!
//! New in this rewrite: `SetColor` can target any button, `RunButton` runs
//! another button's list as part of the chain, the trigger velocity is
//! available to every action through [`RunContext`], and a button with `hold`
//! actions tells a tap (down list on release) from a long press (hold list).

use super::builtins;
use crate::midi::ConnectedDevice;
use super::exec::execute_external;
use super::model::*;
use super::services::Services;
use super::sink::EngineSink;
use crate::midi::types::{ButtonEvent, ControlEvent, ControlKind, PressureEvent};
use crate::profile::{self, Fader, PadColor, Profile, SharedProfile};
use parking_lot::Mutex;
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::runtime::Handle;
use tokio::sync::watch;
use tokio_util::sync::CancellationToken;

/// Nested `RunButton` calls deeper than this are refused (self-calling buttons).
const MAX_DEPTH: u8 = 8;
/// A looping list that finishes faster than this sleeps a little so an empty
/// or delay-free loop cannot spin the CPU.
const MIN_PASS: Duration = Duration::from_millis(5);
/// Legacy waited this long after toggling push-to-talk before continuing.
const PTT_SETTLE: Duration = Duration::from_millis(250);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ActionList {
    Down,
    Up,
    /// Long-press actions (`Button::hold`)
    Hold,
    /// A fader's `on_change` actions (a touch strip's "while moving")
    Fader,
    /// A touch strip's `on_touch` actions
    FaderTouch,
    /// A touch strip's `on_release` actions
    FaderRelease,
}

impl ActionList {
    /// The name the `{{trigger}}` variable and the interface use.
    pub fn as_str(self) -> &'static str {
        match self {
            ActionList::Down => "down",
            ActionList::Up => "up",
            ActionList::Hold => "hold",
            ActionList::Fader => "fader",
            ActionList::FaderTouch => "faderTouch",
            ActionList::FaderRelease => "faderRelease",
        }
    }

    /// One of a fader's lists rather than a button's.
    pub fn is_fader(self) -> bool {
        matches!(self, ActionList::Fader | ActionList::FaderTouch | ActionList::FaderRelease)
    }
}

const HOLD_ARMED: u8 = 0;
const HOLD_FIRED: u8 = 1;
const HOLD_RELEASED: u8 = 2;

/// A pressed button with hold actions: the timer and the release race for the state.
struct HoldArm {
    token: CancellationToken,
    state: Arc<AtomicU8>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunningMacro {
    pub id: String,
    pub page_id: String,
    pub x: u8,
    pub y: u8,
    pub list: ActionList,
    pub started_at_ms: u64,
}

struct RunnerHandle {
    info: RunningMacro,
    token: CancellationToken,
}

struct Inner {
    profile: SharedProfile,
    /// Pads with a running macro as (page, x, y), shared with the LED renderer.
    running_pads: Arc<Mutex<HashSet<(String, u8, u8)>>>,
    sink: Arc<dyn EngineSink>,
    services: Services,
    /// Variables shared by every macro.
    globals: Mutex<HashMap<String, String>>,
    runtime: Handle,
    runners: Mutex<HashMap<String, RunnerHandle>>,
    /// Armed long presses by (page, x, y).
    holds: Mutex<HashMap<(String, u8, u8), HoldArm>>,
    /// Latest aftertouch per held pad, read live by `{{pressure}}`.
    pressure: Mutex<HashMap<(u8, u8), u8>>,
    /// When each pad went down and, once released, came up, read by `{{heldMs}}`.
    presses: Mutex<HashMap<(u8, u8), PadPress>>,
    /// The connected device as the manager last reported it, read by `{{model}}` and friends.
    device: Mutex<Option<ConnectedDevice>>,
    /// Latest knob / strip value per fader while a worker is pacing its actions.
    pending_controls: Mutex<HashMap<String, PendingControl>>,
    ptt_count: Mutex<i32>,
    epoch: Instant,
}

fn env_of(inner: &Inner) -> builtins::Env {
    builtins::Env {
        obs: inner.services.obs.as_ref().map(|h| h.state()),
        slobs: inner.services.slobs.as_ref().map(|h| h.state()),
        device: inner.device.lock().clone(),
        downloads: inner.services.downloads.clone(),
        config_dir: inner.services.config_dir.clone(),
    }
}

/// A pad's last press: when it went down and, once released, came up.
#[derive(Debug, Clone, Copy)]
struct PadPress {
    down: Instant,
    up: Option<Instant>,
}

/// Cheap handle to the engine; clone freely.
#[derive(Clone)]
pub struct MacroEngine {
    inner: Arc<Inner>,
}

/// What an action sees while it runs.
#[derive(Clone)]
pub struct RunContext {
    inner: Arc<Inner>,
    pub runner_id: String,
    pub page_id: String,
    pub x: u8,
    pub y: u8,
    /// Trigger velocity (1-127; models without velocity report 127).
    pub velocity: u8,
    /// The list this run executes, read by `{{trigger}}`.
    pub list: ActionList,
    pub token: CancellationToken,
    /// Registers of this run, shared with buttons it calls.
    pub locals: Arc<Mutex<HashMap<String, String>>>,
    depth: u8,
}

impl MacroEngine {
    pub fn new(
        profile: SharedProfile,
        running_pads: Arc<Mutex<HashSet<(String, u8, u8)>>>,
        sink: Arc<dyn EngineSink>,
        services: Services,
        runtime: Handle,
    ) -> Self {
        MacroEngine {
            inner: Arc::new(Inner {
                profile,
                running_pads,
                sink,
                services,
                globals: Mutex::new(HashMap::new()),
                runtime,
                runners: Mutex::new(HashMap::new()),
                holds: Mutex::new(HashMap::new()),
                pressure: Mutex::new(HashMap::new()),
                presses: Mutex::new(HashMap::new()),
                device: Mutex::new(None),
                pending_controls: Mutex::new(HashMap::new()),
                ptt_count: Mutex::new(0),
                epoch: Instant::now(),
            }),
        }
    }

    /// What surrounds a run right now, for previews and the interface.
    pub fn env(&self) -> builtins::Env {
        env_of(&self.inner)
    }

    /// The manager reports the connected device here; `{{model}}` and friends read it.
    pub fn set_device(&self, device: Option<ConnectedDevice>) {
        *self.inner.device.lock() = device;
    }

    #[cfg(test)]
    pub fn globals_mut_for_test(&self, f: impl FnOnce(&mut HashMap<String, String>)) {
        f(&mut self.inner.globals.lock());
    }

    /// Aftertouch on a held pad: kept for `{{pressure}}` until the pad is released.
    pub fn on_pressure(&self, event: &PressureEvent) {
        self.inner.pressure.lock().insert((event.x, event.y), event.value);
    }

    /// A knob or touch strip moved: the fader sitting on that cell takes the value.
    /// Knobs stream many values a second, so one worker per fader shows the latest
    /// value every `CONTROL_INTERVAL` (LEDs, the on-screen level and `fader.<name>`
    /// follow the hand) and runs the fader's actions once, with the value the
    /// movement came to rest on, after `CONTROL_SETTLE` without a newer one.
    pub fn on_control(&self, event: &ControlEvent) {
        let (page_id, hit) = {
            let store = self.inner.profile.lock();
            let Some(page) = store.profile.active() else { return };
            let Some((f, _)) = page.fader_at(event.x, event.y) else { return };
            let mut at = f.clone();
            at.value = f.min + (f.max - f.min) * event.value.clamp(0.0, 1.0) as f64;
            let hit = FaderHit { id: f.id.clone(), key: f.variable_key(), step: at.level_step(), steps: at.steps(), value: at.value, min: f.min, max: f.max, decimals: f.decimals, display: at.display_text() };
            (page.id.clone(), hit)
        };
        let id = hit.id.clone();
        let start_worker = {
            let mut pending = self.inner.pending_controls.lock();
            let slot = pending.entry(id.clone()).or_default();
            // A release overtaking a value not shown yet must not lose it: that value is
            // the one the control was let go at.
            if event.released {
                if let Some(touched) = slot.latest.take().filter(|v| !v.released) {
                    slot.resting = Some(touched);
                }
            }
            let value = ControlValue { page_id, x: event.x, y: event.y, hit, kind: event.kind, released: event.released };
            if !event.released && event.kind != ControlKind::Knob && !slot.touching && slot.first.is_none() {
                slot.first = Some(value.clone());
            }
            slot.latest = Some(value);
            slot.changed = Some(Instant::now());
            !std::mem::replace(&mut slot.busy, true)
        };
        if !start_worker {
            return;
        }
        let engine = MacroEngine { inner: self.inner.clone() };
        self.inner.runtime.spawn(async move {
            loop {
                tokio::time::sleep(CONTROL_INTERVAL).await;
                let step = {
                    let mut pending = engine.inner.pending_controls.lock();
                    let slot = pending.entry(id.clone()).or_default();
                    let rested = slot.changed.map(|t| t.elapsed() >= CONTROL_SETTLE).unwrap_or(true);
                    match slot.latest.take() {
                        // A sprung strip let go: show where it sprang to, and run the release
                        // list for the value it was let go at (the spring-back itself never counts).
                        Some(v) if v.released => {
                            // A tap shorter than a poll: the touch list still runs, before the release.
                            let touch = if slot.touching { None } else { slot.first.take() };
                            slot.touching = false;
                            slot.first = None;
                            match slot.resting.take() {
                                Some(touched) => ControlStep::ShowThenRelease { touch, shown: v, touched },
                                None => ControlStep::Show(v),
                            }
                        }
                        // A strip under a finger: the first value is the touch, every value a move.
                        Some(v) if v.kind != ControlKind::Knob => {
                            let first = !slot.touching;
                            slot.touching = true;
                            slot.resting = Some(v.clone());
                            if first {
                                let touch = slot.first.take().unwrap_or_else(|| v.clone());
                                ControlStep::TouchThenMove { touch, moved: v }
                            } else {
                                slot.first = None;
                                ControlStep::Move(v)
                            }
                        }
                        // A knob's newer value: show it now; its actions wait for the hand to rest.
                        Some(v) => {
                            slot.resting = Some(v.clone());
                            ControlStep::Show(v)
                        }
                        None if !rested => ControlStep::Wait,
                        // Rested: a knob's actions run once with the value it came to rest on; a
                        // strip without a spring counts as let go (a sprung one reports that itself).
                        None => match slot.resting.take() {
                            Some(v) if v.kind == ControlKind::SprungStrip => {
                                slot.resting = Some(v);
                                ControlStep::Wait
                            }
                            Some(v) if v.kind == ControlKind::Strip => {
                                slot.touching = false;
                                slot.first = None;
                                ControlStep::Release(v)
                            }
                            Some(v) => ControlStep::Run(v),
                            None => {
                                slot.busy = false;
                                slot.changed = None;
                                slot.touching = false;
                                slot.first = None;
                                ControlStep::Done
                            }
                        },
                    }
                };
                match step {
                    ControlStep::Show(v) => engine.fader_pressed(&v.page_id, v.x, v.y, v.hit, 127, None),
                    ControlStep::Run(v) | ControlStep::Move(v) => engine.fader_pressed(&v.page_id, v.x, v.y, v.hit, 127, Some(ActionList::Fader)),
                    ControlStep::TouchThenMove { touch, moved } => {
                        engine.fader_pressed(&touch.page_id, touch.x, touch.y, touch.hit, 127, Some(ActionList::FaderTouch));
                        engine.fader_pressed(&moved.page_id, moved.x, moved.y, moved.hit, 127, Some(ActionList::Fader));
                    }
                    ControlStep::Release(v) => engine.fader_pressed(&v.page_id, v.x, v.y, v.hit, 127, Some(ActionList::FaderRelease)),
                    ControlStep::ShowThenRelease { touch, shown, touched } => {
                        if let Some(t) = touch {
                            engine.fader_pressed(&t.page_id, t.x, t.y, t.hit, 127, Some(ActionList::FaderTouch));
                        }
                        engine.fader_pressed(&touched.page_id, touched.x, touched.y, touched.hit, 127, Some(ActionList::FaderRelease));
                        engine.fader_pressed(&shown.page_id, shown.x, shown.y, shown.hit, 127, None);
                    }
                    ControlStep::Wait => {}
                    ControlStep::Done => break,
                }
            }
        });
    }

    /// Hardware or UI press/release on the active page.
    pub fn on_button(&self, event: &ButtonEvent) {
        if !event.pressed {
            self.inner.pressure.lock().remove(&(event.x, event.y));
        }
        {
            let mut presses = self.inner.presses.lock();
            if event.pressed {
                presses.insert((event.x, event.y), PadPress { down: Instant::now(), up: None });
            } else if let Some(press) = presses.get_mut(&(event.x, event.y)) {
                press.up = Some(Instant::now());
            }
        }
        let (page_id, hold_ms, fader) = {
            let store = self.inner.profile.lock();
            let Some(page) = store.profile.active() else { return };
            let hold = page.get(event.x, event.y).filter(|b| !b.hold.is_empty()).map(|b| (b.hold_ms, b.hold_wait));
            let fader = page.fader_at(event.x, event.y).map(|(f, step)| {
                let mut at = f.clone();
                at.value = f.value_at_step(step);
                FaderHit { id: f.id.clone(), key: f.variable_key(), step, steps: f.steps(), value: at.value, min: f.min, max: f.max, decimals: f.decimals, display: at.display_text() }
            });
            (page.id.clone(), hold, fader)
        };
        let velocity = event.value.max(1);
        let (x, y) = (event.x, event.y);
        if let Some(hit) = fader {
            // A fader pad sets the level; the release does nothing.
            if event.pressed {
                self.fader_pressed(&page_id, x, y, hit, velocity, Some(ActionList::Fader));
            }
            return;
        }
        let Some((hold_ms, hold_wait)) = hold_ms else {
            let list = if event.pressed { ActionList::Down } else { ActionList::Up };
            let _ = self.start(&page_id, x, y, list, velocity, 0, None);
            return;
        };

        let key = (page_id.clone(), x, y);
        if !hold_wait {
            // Pressed actions run at once; the held list is extra after the hold time.
            if event.pressed {
                let _ = self.start(&page_id, x, y, ActionList::Down, velocity, 0, None);
                let token = CancellationToken::new();
                if let Some(old) = self.inner.holds.lock().insert(key, HoldArm { token: token.clone(), state: Arc::new(AtomicU8::new(HOLD_ARMED)) }) {
                    old.token.cancel();
                }
                let engine = self.clone();
                self.inner.runtime.spawn(async move {
                    tokio::select! {
                        biased;
                        _ = token.cancelled() => {}
                        _ = tokio::time::sleep(Duration::from_millis(hold_ms.max(50))) => {
                            let _ = engine.start(&page_id, x, y, ActionList::Hold, velocity, 0, None);
                        }
                    }
                });
            } else {
                if let Some(arm) = self.inner.holds.lock().remove(&key) {
                    arm.token.cancel();
                }
                let _ = self.start(&page_id, x, y, ActionList::Up, velocity, 0, None);
            }
            return;
        }
        if event.pressed {
            // Arm the long press. The timer and the release race for the state:
            // whoever wins runs either the hold list or the tap (down) list.
            let arm = HoldArm { token: CancellationToken::new(), state: Arc::new(AtomicU8::new(HOLD_ARMED)) };
            let (token, state) = (arm.token.clone(), arm.state.clone());
            if let Some(old) = self.inner.holds.lock().insert(key, arm) {
                old.token.cancel();
            }
            let engine = self.clone();
            self.inner.runtime.spawn(async move {
                tokio::select! {
                    biased;
                    _ = token.cancelled() => {}
                    _ = tokio::time::sleep(Duration::from_millis(hold_ms.max(50))) => {
                        if state.compare_exchange(HOLD_ARMED, HOLD_FIRED, Ordering::AcqRel, Ordering::Acquire).is_ok() {
                            let _ = engine.start(&page_id, x, y, ActionList::Hold, velocity, 0, None);
                        }
                    }
                }
            });
        } else {
            let arm = self.inner.holds.lock().remove(&key);
            if let Some(arm) = arm {
                if arm.state.compare_exchange(HOLD_ARMED, HOLD_RELEASED, Ordering::AcqRel, Ordering::Acquire).is_ok() {
                    arm.token.cancel();
                    let _ = self.start(&page_id, x, y, ActionList::Down, velocity, 0, None);
                }
            }
            let _ = self.start(&page_id, x, y, ActionList::Up, velocity, 0, None);
        }
    }

    /// Move a fader (by name or id, on any page) to `value`, clamped to its
    /// range, exactly as a press would: LEDs, `fader.<name>`, and its actions
    /// unless `run_actions` is off. Returns false when no fader matches.
    pub fn set_fader_level(&self, name: &str, value: f64, run_actions: bool) -> bool {
        let name = name.trim();
        let found = {
            let store = self.inner.profile.lock();
            store.profile.pages.iter().find_map(|p| p.faders.iter().find(|f| f.variable_key() == name || f.name.trim() == name || f.id == name).map(|f| (p.id.clone(), f.clone())))
        };
        let Some((page_id, fader)) = found else { return false };
        let (lo, hi) = if fader.min <= fader.max { (fader.min, fader.max) } else { (fader.max, fader.min) };
        let value = if value.is_finite() { value.clamp(lo, hi) } else { lo };
        if (fader.value - value).abs() < 1e-9 {
            return true;
        }
        let mut at = fader.clone();
        at.value = value;
        let hit = FaderHit {
            id: fader.id.clone(),
            key: fader.variable_key(),
            step: at.level_step(),
            steps: at.steps(),
            value,
            min: fader.min,
            max: fader.max,
            decimals: fader.decimals,
            display: at.display_text(),
        };
        self.fader_pressed(&page_id, fader.x, fader.y, hit, 127, run_actions.then_some(ActionList::Fader));
        true
    }

    /// Persist a fader's new level, expose it as `fader.<name>` and run its actions.
    /// Apply a fader's value (LEDs, level, variables) and run one of its lists, if any.
    fn fader_pressed(&self, page_id: &str, x: u8, y: u8, hit: FaderHit, velocity: u8, run: Option<ActionList>) {
        let page_for = page_id.to_string();
        let id_for = hit.id.clone();
        let value = hit.value;
        self.inner.commit(move |p| {
            let fader = p
                .page_mut(&page_for)
                .and_then(|pg| pg.fader_mut(&id_for))
                .ok_or_else(|| crate::profile::store::ProfileError::Invalid(format!("no fader {id_for}")))?;
            fader.value = value;
            Ok(())
        });
        let span = hit.max - hit.min;
        let fraction = if span.abs() < f64::EPSILON { 0.0 } else { ((value - hit.min) / span).clamp(0.0, 1.0) };
        let text = format!("{:.*}", hit.decimals as usize, value);
        let mut locals: HashMap<String, String> = HashMap::new();
        locals.insert("value".into(), text.clone());
        locals.insert("percent".into(), ((fraction * 100.0).round() as i64).to_string());
        locals.insert("fraction".into(), format!("{fraction:.3}"));
        locals.insert("step".into(), hit.step.to_string());
        locals.insert("steps".into(), hit.steps.to_string());
        locals.insert("display".into(), hit.display.clone());
        // Published under the variable key, and under the id, which never changes.
        let snapshot = {
            let mut globals = self.inner.globals.lock();
            globals.insert(format!("fader.{}", hit.id), text.clone());
            if hit.key != hit.id {
                globals.insert(format!("fader.{}", hit.key), text);
            }
            globals.clone()
        };
        self.inner.sink.variables_changed(&snapshot);
        if let Some(list) = run {
            let _ = self.start_with(page_id, x, y, list, velocity, 0, None, Some(Arc::new(Mutex::new(locals))));
        }
    }

    /// Run one list of a button. Returns a receiver that flips to `true` when
    /// the runner finished, or `None` if the button has nothing to run.
    pub fn start(
        &self,
        page_id: &str,
        x: u8,
        y: u8,
        list: ActionList,
        velocity: u8,
        depth: u8,
        parent: Option<&CancellationToken>,
    ) -> Option<watch::Receiver<bool>> {
        self.start_with(page_id, x, y, list, velocity, depth, parent, None)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn start_with(
        &self,
        page_id: &str,
        x: u8,
        y: u8,
        list: ActionList,
        velocity: u8,
        depth: u8,
        parent: Option<&CancellationToken>,
        locals: Option<Arc<Mutex<HashMap<String, String>>>>,
    ) -> Option<watch::Receiver<bool>> {
        let has_actions = {
            let store = self.inner.profile.lock();
            let page = store.profile.page(page_id)?;
            if list.is_fader() {
                page.fader_at(x, y).map(|(f, _)| !fader_list(f, list).is_empty()).unwrap_or(false)
            } else {
                let button = page.get(x, y)?;
                match list {
                    ActionList::Down => !button.down.is_empty(),
                    ActionList::Up => !button.up.is_empty(),
                    ActionList::Hold => !button.hold.is_empty(),
                    ActionList::Fader | ActionList::FaderTouch | ActionList::FaderRelease => false,
                }
            }
        };
        if !has_actions {
            return None;
        }
        if depth > MAX_DEPTH {
            tracing::warn!(page = page_id, x, y, "macro nesting too deep, refusing to run");
            return None;
        }

        let id = uuid::Uuid::new_v4().to_string();
        let token = parent.map(|p| p.child_token()).unwrap_or_default();
        let (done_tx, done_rx) = watch::channel(false);
        let info = RunningMacro {
            id: id.clone(),
            page_id: page_id.to_string(),
            x,
            y,
            list,
            started_at_ms: self.inner.epoch.elapsed().as_millis() as u64,
        };
        self.inner.runners.lock().insert(id.clone(), RunnerHandle { info: info.clone(), token: token.clone() });
        self.inner.publish_running();

        let ctx = RunContext {
            inner: self.inner.clone(),
            runner_id: id.clone(),
            page_id: page_id.to_string(),
            x,
            y,
            velocity,
            list,
            token,
            locals: locals.unwrap_or_default(),
            depth,
        };
        tracing::info!(id = %id, page = page_id, x, y, ?list, velocity, "macro started");
        self.inner.runtime.spawn(async move {
            run_lists(ctx.clone(), list).await;
            ctx.inner.finish(&ctx.runner_id);
            let _ = done_tx.send(true);
        });
        Some(done_rx)
    }

    pub fn stop_all(&self) {
        self.inner.stop_all();
    }

    pub fn stop_at(&self, page_id: &str, x: u8, y: u8) {
        self.inner.stop_at(page_id, x, y, None);
    }

    pub fn globals(&self) -> HashMap<String, String> {
        self.inner.globals.lock().clone()
    }

    /// Replace the shared variables (used to restore them at start-up).
    pub fn set_globals(&self, globals: HashMap<String, String>) {
        *self.inner.globals.lock() = globals;
    }

    /// Drop the named shared variables. Returns how many existed.
    pub fn remove_globals(&self, names: &[String]) -> usize {
        let snapshot = {
            let mut globals = self.inner.globals.lock();
            let before = globals.len();
            for name in names {
                globals.remove(name.trim());
            }
            if globals.len() == before {
                return 0;
            }
            globals.clone()
        };
        let removed = names.len();
        self.inner.sink.variables_changed(&snapshot);
        removed
    }

    /// Create or change one shared variable by hand (the settings' variables
    /// list). Provided names are refused, and a name has to work inside
    /// `{{...}}`. A `fader.<name>` value moves that fader to it without running
    /// its actions: the level follows its variable, but nothing was triggered.
    pub fn set_global(&self, name: &str, value: String) -> Result<(), String> {
        let name = name.trim();
        if name.is_empty() {
            return Err("the name is empty".into());
        }
        if name.chars().any(|c| c.is_whitespace() || c == '{' || c == '}') {
            return Err("a name cannot contain spaces or braces".into());
        }
        if builtins::is_builtin(name) {
            return Err(format!("{name} is provided by Lunchpad and cannot be set"));
        }
        let snapshot = {
            let mut globals = self.inner.globals.lock();
            globals.insert(name.to_string(), value.clone());
            globals.clone()
        };
        self.inner.sink.variables_changed(&snapshot);
        if let Some(fader) = name.strip_prefix("fader.") {
            if let Ok(number) = value.trim().parse::<f64>() {
                self.set_fader_level(fader, number, false);
            }
        }
        Ok(())
    }

    /// Drop every shared variable.
    pub fn clear_globals(&self) {
        let snapshot = {
            let mut globals = self.inner.globals.lock();
            globals.clear();
            globals.clone()
        };
        self.inner.sink.variables_changed(&snapshot);
    }

    /// Fader values are derived state: drop every `fader.*` variable that no fader on any
    /// page publishes any more (renamed or removed faders). Returns how many went.
    pub fn prune_fader_variables(&self) -> usize {
        let keep: HashSet<String> = {
            let store = self.inner.profile.lock();
            store
                .profile
                .pages
                .iter()
                .flat_map(|p| p.faders.iter())
                .flat_map(|f| [format!("fader.{}", f.id), format!("fader.{}", f.variable_key())])
                .collect()
        };
        let stale: Vec<String> = self.inner.globals.lock().keys().filter(|k| k.starts_with("fader.") && !keep.contains(*k)).cloned().collect();
        if stale.is_empty() {
            return 0;
        }
        tracing::info!(count = stale.len(), "dropping stale fader variables");
        self.remove_globals(&stale)
    }

    pub fn running(&self) -> Vec<RunningMacro> {
        let mut list: Vec<RunningMacro> = self.inner.runners.lock().values().map(|r| r.info.clone()).collect();
        list.sort_by_key(|r| r.started_at_ms);
        list
    }
}

impl RunContext {
    pub(crate) fn services(&self) -> &Services {
        &self.inner.services
    }

    /// Placeholder values: globals, then locals, then the provided variables on top.
    pub fn variables(&self) -> HashMap<String, String> {
        let mut vars: HashMap<String, String> = self.inner.globals.lock().clone();
        vars.extend(self.locals.lock().iter().map(|(k, v)| (k.clone(), v.clone())));
        vars.extend(builtins::values(&self.press(), &self.env()).into_iter().map(|(k, v)| (k.to_string(), v)));
        vars
    }

    /// The press as the provided variables describe it.
    pub fn press(&self) -> builtins::Press {
        let pressure = self.inner.pressure.lock().get(&(self.x, self.y)).copied().unwrap_or(0);
        let (page_name, caption) = {
            let store = self.inner.profile.lock();
            let page = store.profile.pages.iter().find(|p| p.id == self.page_id);
            let caption = page
                .and_then(|p| p.get(self.x, self.y))
                .map(|b: &crate::profile::model::Button| match &b.look {
                    crate::profile::model::Look::Text { caption, .. } => caption.clone(),
                    _ => String::new(),
                })
                .unwrap_or_default();
            (page.map(|p| p.name.clone()).unwrap_or_default(), caption)
        };
        let held_ms = self
            .inner
            .presses
            .lock()
            .get(&(self.x, self.y))
            .map(|press| press.up.unwrap_or_else(Instant::now).duration_since(press.down).as_millis() as u64)
            .unwrap_or(0);
        builtins::Press { velocity: self.velocity, pressure, x: self.x, y: self.y, trigger: self.list.as_str(), held_ms, page_id: self.page_id.clone(), page_name, caption }
    }

    /// What surrounds the run: the streaming apps' state, the device and the folders.
    pub fn env(&self) -> builtins::Env {
        env_of(&self.inner)
    }

    /// What the `Lunchpad` object describes to a script.
    pub fn script_info(&self) -> serde_json::Value {
        // The press and the surroundings first: `press()` takes the profile lock
        // itself, and taking it here as well would block this runner for good.
        let press = self.press();
        let env = self.env();
        let store = self.inner.profile.lock();
        builtins::script_info(&store.profile, &press, &env)
    }

    /// A page id as given, or the id of the page with that name; unknown names stay as they are.
    pub fn page_id_for(&self, id_or_name: &str) -> String {
        let store = self.inner.profile.lock();
        let pages = &store.profile.pages;
        if pages.iter().any(|p| p.id == id_or_name) {
            return id_or_name.to_string();
        }
        pages
            .iter()
            .find(|p| p.name == id_or_name)
            .or_else(|| pages.iter().find(|p| p.name.eq_ignore_ascii_case(id_or_name)))
            .map(|p| p.id.clone())
            .unwrap_or_else(|| id_or_name.to_string())
    }

    pub fn globals_snapshot(&self) -> HashMap<String, String> {
        self.inner.globals.lock().clone()
    }

    /// The user's named secrets as `secret.<name>`. Kept out of [`variables`]
    /// so they never reach scripts, the variables view or a saved file.
    pub fn secrets(&self) -> HashMap<String, String> {
        match &self.inner.services.settings {
            Some(settings) => settings.lock().secrets.users().into_iter().map(|(name, value)| (format!("secret.{name}"), value)).collect(),
            None => HashMap::new(),
        }
    }

    /// Replace `{{name}}` placeholders in `text`: secrets first, then variables.
    pub fn expand(&self, text: &str) -> String {
        if !text.contains("{{") {
            return text.to_string();
        }
        let mut out = text.to_string();
        if out.contains("{{secret.") {
            for (k, v) in &self.secrets() {
                out = out.replace(&format!("{{{{{k}}}}}"), v);
            }
        }
        for (k, v) in &self.variables() {
            out = out.replace(&format!("{{{{{k}}}}}"), v);
        }
        out
    }

    pub fn set_var(&self, name: &str, value: String, scope: VarScope) {
        let name = name.trim();
        if name.is_empty() {
            return;
        }
        if builtins::is_builtin(name) {
            tracing::warn!(name, "a provided variable cannot be changed");
            return;
        }
        match scope {
            VarScope::Local => {
                self.locals.lock().insert(name.to_string(), value);
            }
            VarScope::Global => {
                self.inner.globals.lock().insert(name.to_string(), value.clone());
                self.inner.sink.variables_changed(&self.inner.globals.lock());
                self.follow_fader_variable(name, &value);
            }
        }
    }

    pub fn merge_globals(&self, mut values: HashMap<String, String>) {
        values.retain(|name, _| {
            let ok = !builtins::is_builtin(name);
            if !ok {
                tracing::warn!(name, "a provided variable cannot be changed");
            }
            ok
        });
        if values.is_empty() {
            return;
        }
        {
            let mut g = self.inner.globals.lock();
            g.extend(values.clone());
            self.inner.sink.variables_changed(&g);
        }
        for (name, value) in &values {
            self.follow_fader_variable(name, value);
        }
    }

    /// Writing `fader.<name>` from an action moves that fader and runs its
    /// actions, so "add 5 to fader.mic" nudges the level like a press would.
    fn follow_fader_variable(&self, name: &str, value: &str) {
        let Some(fader) = name.strip_prefix("fader.") else { return };
        let Ok(number) = value.trim().parse::<f64>() else { return };
        MacroEngine { inner: self.inner.clone() }.set_fader_level(fader, number, true);
    }
}

impl Inner {
    fn publish_running(&self) {
        let runners = self.runners.lock();
        let list: Vec<RunningMacro> = runners.values().map(|r| r.info.clone()).collect();
        // A fader's own actions run "at" its first pad; that pad shows the level, not a running ring.
        let pads: HashSet<(String, u8, u8)> = runners.values().filter(|r| !r.info.list.is_fader()).map(|r| (r.info.page_id.clone(), r.info.x, r.info.y)).collect();
        drop(runners);
        *self.running_pads.lock() = pads;
        self.sink.running_changed(&list);
        self.sink.repaint();
    }

    fn finish(&self, id: &str) {
        self.runners.lock().remove(id);
        tracing::info!(id, "macro finished");
        self.publish_running();
        if *self.ptt_count.lock() <= 0 {
            self.sink.push_to_talk(false);
        }
    }

    fn stop_all(&self) {
        let runners = self.runners.lock();
        for r in runners.values() {
            r.token.cancel();
        }
        drop(runners);
        *self.ptt_count.lock() = 0;
        self.sink.push_to_talk(false);
        if let Some(audio) = &self.services.audio {
            audio.stop_all();
        }
        if let Some(speech) = &self.services.speech {
            speech.stop();
        }
    }

    fn stop_at(&self, page_id: &str, x: u8, y: u8, except: Option<&str>) {
        let runners = self.runners.lock();
        for r in runners.values() {
            if r.info.page_id == page_id && r.info.x == x && r.info.y == y && Some(r.info.id.as_str()) != except {
                r.token.cancel();
            }
        }
    }

    fn commit<T>(&self, f: impl FnOnce(&mut Profile) -> Result<T, crate::profile::store::ProfileError>) -> Option<T> {
        match profile::mutate(&self.profile, f) {
            Ok((out, profile)) => {
                self.sink.profile_changed(&profile);
                self.sink.repaint();
                Some(out)
            }
            Err(e) => {
                tracing::warn!(error = %e, "macro could not change the profile");
                None
            }
        }
    }
}

/// Run the requested list; `Tap` semantics live in `run_button` (down then up).
async fn run_lists(ctx: RunContext, list: ActionList) {
    let mut pass: u32 = 0;
    loop {
        let started = Instant::now();
        let Some((actions, loop_down)) = snapshot(&ctx, list) else { break };
        run_pass(&ctx, &actions).await;
        pass += 1;
        let repeat = loop_down && list == ActionList::Down && !ctx.token.is_cancelled() && !actions.is_empty();
        if !repeat {
            break;
        }
        if started.elapsed() < MIN_PASS {
            tokio::time::sleep(MIN_PASS).await;
        }
    }
    tracing::debug!(id = %ctx.runner_id, passes = pass, cancelled = ctx.token.is_cancelled(), "runner done");
}

fn snapshot(ctx: &RunContext, list: ActionList) -> Option<(Vec<Action>, bool)> {
    let store = ctx.inner.profile.lock();
    let page = store.profile.page(&ctx.page_id)?;
    if list.is_fader() {
        return page.fader_at(ctx.x, ctx.y).map(|(f, _)| (fader_list(f, list).clone(), false));
    }
    let button = page.get(ctx.x, ctx.y)?;
    let actions = match list {
        ActionList::Down => button.down.clone(),
        ActionList::Up => button.up.clone(),
        ActionList::Hold => button.hold.clone(),
        ActionList::Fader | ActionList::FaderTouch | ActionList::FaderRelease => Vec::new(),
    };
    Some((actions, button.loop_down))
}

/// The fader's list behind one of the fader `ActionList`s.
fn fader_list(fader: &Fader, list: ActionList) -> &Vec<Action> {
    match list {
        ActionList::FaderTouch => &fader.on_touch,
        ActionList::FaderRelease => &fader.on_release,
        _ => &fader.on_change,
    }
}

/// How often a fader driven by a knob or strip shows the newest value.
const CONTROL_INTERVAL: Duration = Duration::from_millis(60);
/// How long the hand has to rest on a knob or strip before the fader's actions
/// run: the level follows every movement, the actions fire once per stop.
const CONTROL_SETTLE: Duration = Duration::from_millis(150);

/// A value a knob or strip delivered for the fader on it.
#[derive(Clone)]
struct ControlValue {
    page_id: String,
    x: u8,
    y: u8,
    hit: FaderHit,
    kind: ControlKind,
    /// The control sprang back on its own (see `ControlEvent::released`).
    released: bool,
}

/// One tick of a fader's control worker.
enum ControlStep {
    /// Show a newer value (LEDs, level, variables), no actions.
    Show(ControlValue),
    /// A knob's movement rested: its actions run with the value it stopped on.
    Run(ControlValue),
    /// A finger landed on a strip: the touch list with the value it landed with, then the
    /// move list with the newest value.
    TouchThenMove { touch: ControlValue, moved: ControlValue },
    /// A strip moved under the finger: the move list.
    Move(ControlValue),
    /// A strip was let go (rested, or the spring-back): the release list.
    Release(ControlValue),
    /// A sprung strip let go: the touch list if it never got its turn, the release list
    /// for the value it was let go at, then the rest position as the level.
    ShowThenRelease { touch: Option<ControlValue>, shown: ControlValue, touched: ControlValue },
    /// Still moving, nothing new to show.
    Wait,
    /// Rested and everything is applied.
    Done,
}

#[derive(Default)]
struct PendingControl {
    /// The newest value not shown yet.
    latest: Option<ControlValue>,
    busy: bool,
    /// When the newest value arrived; the movement has rested once that is
    /// `CONTROL_SETTLE` ago.
    changed: Option<Instant>,
    /// The last value shown whose actions have not run yet (a knob's rest value, or
    /// what a strip was last touched at).
    resting: Option<ControlValue>,
    /// The value a finger landed with, kept until the touch list has run: a move that
    /// arrives before the next poll replaces `latest`, and must not replace the touch.
    first: Option<ControlValue>,
    /// A finger is on the strip: the next value is a move, not a touch.
    touching: bool,
}

/// What the engine needs from a fader pad press, copied out of the profile lock.
#[derive(Clone)]
struct FaderHit {
    id: String,
    /// `fader.<key>` is what macros read; see `Fader::variable_key`.
    key: String,
    step: usize,
    steps: usize,
    value: f64,
    min: f64,
    max: f64,
    decimals: u8,
    /// The value as the pad shows it (display scale)
    display: String,
}

async fn run_pass(ctx: &RunContext, actions: &[Action]) {
    let mut flip_a = true;
    let mut active = true;
    // While set, everything is skipped until the marker with this id is reached.
    let mut skip_until: Option<String> = None;
    let mut children = Vec::new();

    for action in actions {
        if ctx.token.is_cancelled() {
            break;
        }
        if let Some(target) = &skip_until {
            if *target != action.id {
                continue;
            }
            // Landed on the marker we were skipping to (an Else or End): resume
            // after it without running the marker's own logic.
            skip_until = None;
            continue;
        }
        match &action.kind {
            ActionKind::FlipFlopStart { is_a, .. } => {
                flip_a = *is_a;
                active = flip_a;
                continue;
            }
            ActionKind::FlipFlopMiddle { .. } => {
                active = !flip_a;
                continue;
            }
            ActionKind::FlipFlopEnd { start_id, .. } => {
                active = true;
                persist_flip(ctx, start_id, !flip_a);
                continue;
            }
            ActionKind::IfStart { variable, op, value, else_id, .. } => {
                let vars = ctx.variables();
                let left = vars.get(variable.trim()).cloned().unwrap_or_default();
                let right = ctx.expand(value);
                let holds = op.test(&left, &right);
                tracing::debug!(id = %action.id, variable, ?op, left = %left, right = %right, holds, "branch");
                if !holds {
                    skip_until = Some(else_id.clone());
                }
                continue;
            }
            ActionKind::IfElse { end_id, .. } => {
                // Reached from the true branch: skip the false branch.
                skip_until = Some(end_id.clone());
                continue;
            }
            ActionKind::IfEnd { .. } => continue,
            _ => {}
        }
        if !active {
            continue;
        }
        if action.wait {
            execute(ctx, action).await;
        } else {
            let ctx2 = ctx.clone();
            let a = action.clone();
            children.push(ctx.inner.runtime.spawn(async move { execute(&ctx2, &a).await }));
        }
    }
    for child in children {
        let _ = child.await;
    }
}

fn persist_flip(ctx: &RunContext, start_id: &str, next_is_a: bool) {
    let (page_id, x, y, start_id) = (ctx.page_id.clone(), ctx.x, ctx.y, start_id.to_string());
    ctx.inner.commit(move |p| {
        let button = p.page_mut(&page_id).and_then(|pg| pg.get_mut(x, y)).ok_or(crate::profile::store::ProfileError::PageNotFound(page_id.clone()))?;
        for a in button.down.iter_mut().chain(button.up.iter_mut()) {
            if a.id == start_id {
                if let ActionKind::FlipFlopStart { is_a, .. } = &mut a.kind {
                    *is_a = next_is_a;
                }
            }
        }
        Ok(())
    });
}

pub(super) async fn execute(ctx: &RunContext, action: &Action) {
    let inner = &ctx.inner;
    match &action.kind {
        ActionKind::Delay { ms, ms_from } => {
            let wait = super::exec::number_from(ctx, ms_from, *ms as f32).max(0.0).round() as u64;
            tokio::select! {
                _ = tokio::time::sleep(Duration::from_millis(wait)) => {}
                _ = ctx.token.cancelled() => {}
            }
        }
        ActionKind::SwitchPage { page_id } => {
            let target = page_id.clone();
            inner.commit(move |p| {
                if p.page(&target).is_none() {
                    return Err(crate::profile::store::ProfileError::PageNotFound(target));
                }
                p.active_page = target;
                Ok(())
            });
        }
        ActionKind::SetFader { fader, value, run_actions } => {
            let engine = MacroEngine { inner: inner.clone() };
            let text = ctx.expand(value);
            match text.trim().parse::<f64>() {
                Ok(v) => {
                    if !engine.set_fader_level(&ctx.expand(fader), v, *run_actions) {
                        tracing::warn!(fader = %fader, "no fader with this name");
                    }
                }
                Err(_) => tracing::warn!(fader = %fader, value = %text, "fader value is not a number"),
            }
        }
        ActionKind::SetColor { color, target } => {
            let (page_id, x, y) = resolve(ctx, target.as_ref());
            let color: PadColor = *color;
            inner.commit(move |p| {
                let button = p
                    .page_mut(&page_id)
                    .and_then(|pg| pg.get_mut(x, y))
                    .ok_or_else(|| crate::profile::store::ProfileError::Invalid(format!("no button at ({x}, {y})")))?;
                button.color = color;
                Ok(())
            });
        }
        ActionKind::RunButton { target, trigger } => {
            let (page_id, x, y) = resolve(ctx, Some(target));
            let engine = MacroEngine { inner: inner.clone() };
            let lists: &[ActionList] = match trigger {
                ButtonTrigger::Press => &[ActionList::Down],
                ButtonTrigger::Release => &[ActionList::Up],
                ButtonTrigger::Tap => &[ActionList::Down, ActionList::Up],
                ButtonTrigger::Hold => &[ActionList::Hold],
            };
            for list in lists {
                if ctx.token.is_cancelled() {
                    break;
                }
                if let Some(mut done) = engine.start_with(&page_id, x, y, *list, ctx.velocity, ctx.depth + 1, Some(&ctx.token), Some(ctx.locals.clone())) {
                    // Waiting is what makes "tap" sequential and lets chains finish in order.
                    tokio::select! {
                        _ = async { while !*done.borrow() { if done.changed().await.is_err() { break } } } => {}
                        _ = ctx.token.cancelled() => {}
                    }
                }
            }
        }
        ActionKind::StopAllMacros => inner.stop_all(),
        ActionKind::StopThisMacro => inner.stop_at(&ctx.page_id, ctx.x, ctx.y, None),
        ActionKind::RestartThisMacro => inner.stop_at(&ctx.page_id, ctx.x, ctx.y, Some(&ctx.runner_id)),
        ActionKind::PushToTalkStart { .. } => {
            if !inner.sink.push_to_talk_enabled() {
                return;
            }
            let became_first = {
                let mut n = inner.ptt_count.lock();
                *n += 1;
                *n == 1
            };
            if became_first {
                inner.sink.push_to_talk(true);
            }
            tokio::select! {
                _ = tokio::time::sleep(PTT_SETTLE) => {}
                _ = ctx.token.cancelled() => {}
            }
        }
        ActionKind::PushToTalkEnd { .. } => {
            if !inner.sink.push_to_talk_enabled() {
                return;
            }
            let release = {
                let mut n = inner.ptt_count.lock();
                *n -= 1;
                *n <= 0
            };
            if release {
                inner.sink.push_to_talk(false);
            }
            tokio::select! {
                _ = tokio::time::sleep(PTT_SETTLE) => {}
                _ = ctx.token.cancelled() => {}
            }
        }
        ActionKind::FlipFlopStart { .. }
        | ActionKind::FlipFlopMiddle { .. }
        | ActionKind::FlipFlopEnd { .. }
        | ActionKind::IfStart { .. }
        | ActionKind::IfElse { .. }
        | ActionKind::IfEnd { .. } => {}
        ActionKind::PlaySound { .. }
        | ActionKind::GetWindow { .. }
        | ActionKind::SetWindow { .. }
        | ActionKind::Mouse { .. }
        | ActionKind::MousePosition { .. }
        | ActionKind::Debug { .. }
        | ActionKind::GetScreen { .. }
        | ActionKind::TextToSpeech { .. }
        | ActionKind::LaunchApplication { .. }
        | ActionKind::Hotkey { .. }
        | ActionKind::ObsSwitchScene { .. }
        | ActionKind::ObsToggleSource { .. }
        | ActionKind::ObsSetAudio { .. }
        | ActionKind::ObsToggleFilter { .. }
        | ActionKind::ObsStream { .. }
        | ActionKind::ObsSaveReplay
        | ActionKind::ObsStudioMode { .. }
        | ActionKind::ObsTriggerHotkey { .. }
        | ActionKind::SlobsSwitchScene { .. }
        | ActionKind::SlobsToggleSource { .. }
        | ActionKind::SlobsSetAudio { .. }
        | ActionKind::SlobsToggleFilter { .. }
        | ActionKind::SlobsStream { .. }
        | ActionKind::SlobsSaveReplay
        | ActionKind::SlobsStudioMode { .. }
        | ActionKind::HomeAssistantTurn { .. }
        | ActionKind::HomeAssistantSetValue { .. }
        | ActionKind::HomeAssistantCallService { .. }
        | ActionKind::SetSystemVolume { .. }
        | ActionKind::StopAllSounds
        | ActionKind::SetAudioDevice { .. }
        | ActionKind::AddToVariable { .. }
        | ActionKind::HttpRequest { .. }
        | ActionKind::SetVariable { .. }
        | ActionKind::RunScript { .. } => execute_external(ctx, action).await,
    }
}

fn resolve(ctx: &RunContext, target: Option<&ButtonRef>) -> (String, u8, u8) {
    match target {
        Some(t) => (t.page_id.clone().unwrap_or_else(|| ctx.page_id.clone()), t.x, t.y),
        None => (ctx.page_id.clone(), ctx.x, ctx.y),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::macros::sink::NullSink;
    use crate::profile::{Button, Fader, FaderDirection, ProfileStore, DEFAULT_PAGE_ID};

    fn engine() -> (MacroEngine, SharedProfile) {
        let dir = std::env::temp_dir().join(format!("lunchpad-engine-{}", uuid::Uuid::new_v4()));
        let profile: SharedProfile = Arc::new(Mutex::new(ProfileStore::load(&dir)));
        let running = Arc::new(Mutex::new(HashSet::new()));
        let engine = MacroEngine::new(profile.clone(), running, Arc::new(NullSink), Services::default(), Handle::current());
        (engine, profile)
    }

    fn set_button(profile: &SharedProfile, x: u8, y: u8, down: Vec<Action>, up: Vec<Action>, loop_down: bool) {
        let mut store = profile.lock();
        let page = store.profile.page_mut(DEFAULT_PAGE_ID).unwrap();
        page.set(x, y, Button { down, up, loop_down, ..Default::default() });
    }

    fn a(kind: ActionKind) -> Action {
        Action::new(kind)
    }

    async fn wait_done(mut rx: watch::Receiver<bool>) {
        while !*rx.borrow() {
            rx.changed().await.unwrap();
        }
    }

    /// A global once it reads `expected`, or whatever it reads when a generous
    /// deadline passes: the control worker's poll and settle add up to a delay a
    /// busy CI runner stretches unpredictably.
    async fn global_once(engine: &MacroEngine, key: &str, expected: &str) -> Option<String> {
        let deadline = Instant::now() + Duration::from_secs(3);
        loop {
            let value = engine.globals().get(key).cloned();
            if value.as_deref() == Some(expected) || Instant::now() >= deadline {
                return value;
            }
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
    }

    #[tokio::test]
    async fn fader_press_sets_the_level_and_runs_its_actions() {
        let (engine, profile) = engine();
        {
            let mut store = profile.lock();
            let page = store.profile.page_mut(DEFAULT_PAGE_ID).unwrap();
            page.set_fader(Fader {
                id: "f1".into(),
                name: "mic".into(),
                x: 0,
                y: 0,
                direction: FaderDirection::Up,
                length: 5,
                min: -60.0,
                max: 0.0,
                decimals: 0,
                on_change: vec![a(ActionKind::SetVariable { name: "got".into(), value: "{{value}}|{{percent}}|{{step}}/{{steps}}".into(), scope: VarScope::Global })],
                ..Fader::default()
            });
        }
        engine.on_button(&ButtonEvent { x: 0, y: 2, pressed: true, note: 0, cc: false, value: 100 });
        engine.on_button(&ButtonEvent { x: 0, y: 2, pressed: false, note: 0, cc: false, value: 0 });
        tokio::time::sleep(Duration::from_millis(120)).await;
        let g = engine.globals();
        assert_eq!(g.get("got").map(String::as_str), Some("-30|50|2/5"));
        assert_eq!(g.get("fader.mic").map(String::as_str), Some("-30"));
        assert_eq!(profile.lock().profile.page(DEFAULT_PAGE_ID).unwrap().faders[0].value, -30.0);
    }

    #[tokio::test]
    async fn a_knob_drives_a_single_cell_fader() {
        let (engine, profile) = engine();
        profile.lock().profile.page_mut(DEFAULT_PAGE_ID).unwrap().set_fader(Fader {
            id: "knob1".into(),
            name: "gain".into(),
            x: 3,
            y: 3,
            length: 1,
            min: 0.0,
            max: 100.0,
            on_change: vec![a(ActionKind::SetVariable { name: "applied".into(), value: "{{value}}".into(), scope: VarScope::Global })],
            ..Fader::default()
        });
        // A burst of values: only the last one runs the actions, after the pacing gap.
        for v in [0.1f32, 0.4, 0.75] {
            engine.on_control(&ControlEvent { x: 3, y: 3, value: v, kind: ControlKind::Knob, released: false });
        }
        engine.on_control(&ControlEvent { x: 4, y: 3, value: 0.5, kind: ControlKind::Knob, released: false }); // no fader here: ignored
        assert_eq!(global_once(&engine, "applied", "75").await.as_deref(), Some("75"));
        assert_eq!(engine.globals().get("fader.gain").map(String::as_str), Some("75"));
        let value = profile.lock().profile.page(DEFAULT_PAGE_ID).unwrap().faders[0].value;
        assert!((value - 75.0).abs() < 1e-9);
    }

    /// While a knob keeps moving the fader's level follows it, but its actions do
    /// not run; they run once, with the final value, after the movement rests.
    #[tokio::test]
    async fn a_sweep_shows_every_value_and_runs_the_actions_once_it_rests() {
        let (engine, profile) = engine();
        profile.lock().profile.page_mut(DEFAULT_PAGE_ID).unwrap().set_fader(Fader {
            id: "knob1".into(),
            name: "gain".into(),
            x: 3,
            y: 3,
            length: 1,
            min: 0.0,
            max: 100.0,
            on_change: vec![a(ActionKind::AddToVariable { name: "runs".into(), amount: "1".into(), scope: VarScope::Global })],
            ..Fader::default()
        });
        // A sweep: a value every 40 ms for 400 ms.
        for i in 1..=10u32 {
            engine.on_control(&ControlEvent { x: 3, y: 3, value: i as f32 / 10.0, kind: ControlKind::Knob, released: false });
            tokio::time::sleep(Duration::from_millis(40)).await;
        }
        // Mid-sweep: the level has been following, the actions have not run.
        let globals = engine.globals();
        let shown: f64 = globals.get("fader.gain").and_then(|v| v.parse().ok()).expect("the level follows the knob");
        assert!(shown >= 50.0, "the level is well into the sweep, got {shown}");
        assert_eq!(globals.get("runs"), None, "no actions while the knob is moving");
        // The hand rests: the actions run once, with the value it stopped on.
        tokio::time::sleep(Duration::from_millis(400)).await;
        let globals = engine.globals();
        assert_eq!(globals.get("fader.gain").map(String::as_str), Some("100"));
        assert_eq!(globals.get("runs").map(String::as_str), Some("1"));
    }

    /// A touch strip runs its touch list when the finger lands, its move list with
    /// every value, and its release list when the finger leaves: a sprung strip
    /// reports that as it springs back (the level follows it there, the release runs
    /// for the value it was let go at, and the spring-back itself runs nothing).
    #[tokio::test]
    async fn a_sprung_strip_runs_touch_move_and_release() {
        let (engine, profile) = engine();
        profile.lock().profile.page_mut(DEFAULT_PAGE_ID).unwrap().set_fader(Fader {
            id: "pitch".into(),
            name: "pitch".into(),
            x: 0,
            y: 7,
            length: 1,
            min: 0.0,
            max: 100.0,
            on_touch: vec![a(ActionKind::SetVariable { name: "touched".into(), value: "{{value}}".into(), scope: VarScope::Global })],
            on_change: vec![a(ActionKind::AddToVariable { name: "moves".into(), amount: "1".into(), scope: VarScope::Global })],
            on_release: vec![a(ActionKind::SetVariable { name: "released".into(), value: "{{value}}".into(), scope: VarScope::Global })],
            ..Fader::default()
        });
        for v in [0.55f32, 0.7, 0.85] {
            engine.on_control(&ControlEvent { x: 0, y: 7, value: v, kind: ControlKind::SprungStrip, released: false });
            tokio::time::sleep(Duration::from_millis(70)).await;
        }
        // Holding still on a sprung strip is not letting go.
        tokio::time::sleep(Duration::from_millis(300)).await;
        assert_eq!(engine.globals().get("released"), None, "no release while the finger rests on a sprung strip");
        engine.on_control(&ControlEvent { x: 0, y: 7, value: 0.5, kind: ControlKind::SprungStrip, released: true });
        tokio::time::sleep(Duration::from_millis(300)).await;
        let globals = engine.globals();
        assert_eq!(globals.get("touched").map(String::as_str), Some("55"), "the touch list ran once, with the first value");
        let moves: u32 = globals.get("moves").and_then(|m| m.parse().ok()).unwrap_or(0);
        assert!((1..=3).contains(&moves), "the move list ran for the values the poll saw, got {moves}");
        assert_eq!(globals.get("released").map(String::as_str), Some("85"), "the release list ran for the value the strip was let go at");
        assert_eq!(globals.get("fader.pitch").map(String::as_str), Some("50"), "the level followed the spring-back");
        // Letting go without a touch first shows the centre and runs nothing.
        engine.on_control(&ControlEvent { x: 0, y: 7, value: 0.5, kind: ControlKind::SprungStrip, released: true });
        tokio::time::sleep(Duration::from_millis(200)).await;
        assert_eq!(engine.globals().get("moves").map(String::as_str), Some(moves.to_string().as_str()), "no move for a release without a touch");
    }

    /// A strip without a spring stays where the finger left it: after resting a moment
    /// it counts as let go, and the next value is a new touch.
    #[tokio::test]
    async fn a_plain_strip_is_let_go_when_it_rests() {
        let (engine, profile) = engine();
        profile.lock().profile.page_mut(DEFAULT_PAGE_ID).unwrap().set_fader(Fader {
            id: "mod".into(),
            name: "mod".into(),
            x: 1,
            y: 7,
            length: 1,
            min: 0.0,
            max: 100.0,
            on_touch: vec![a(ActionKind::AddToVariable { name: "touches".into(), amount: "1".into(), scope: VarScope::Global })],
            on_release: vec![a(ActionKind::SetVariable { name: "released".into(), value: "{{value}}".into(), scope: VarScope::Global })],
            ..Fader::default()
        });
        for v in [0.2f32, 0.4] {
            engine.on_control(&ControlEvent { x: 1, y: 7, value: v, kind: ControlKind::Strip, released: false });
            tokio::time::sleep(Duration::from_millis(70)).await;
        }
        tokio::time::sleep(Duration::from_millis(300)).await;
        let globals = engine.globals();
        assert_eq!(globals.get("touches").map(String::as_str), Some("1"));
        assert_eq!(globals.get("released").map(String::as_str), Some("40"), "rested: let go at the last value");
        engine.on_control(&ControlEvent { x: 1, y: 7, value: 0.6, kind: ControlKind::Strip, released: false });
        tokio::time::sleep(Duration::from_millis(300)).await;
        assert_eq!(engine.globals().get("touches").map(String::as_str), Some("2"), "a value after the rest is a new touch");
    }

    /// Setting a knob's fader by hand (the on-screen control, "Set fader", a
    /// variable write) and then moving the hardware: the hardware wins, and the
    /// value does not fall back to the one set by hand.
    #[tokio::test]
    async fn a_hardware_move_beats_a_value_set_by_hand() {
        let (engine, profile) = engine();
        profile.lock().profile.page_mut(DEFAULT_PAGE_ID).unwrap().set_fader(Fader {
            id: "knob1".into(),
            name: "gain".into(),
            x: 3,
            y: 3,
            length: 1,
            min: 0.0,
            max: 100.0,
            ..Fader::default()
        });
        assert!(engine.set_fader_level("gain", 20.0, false));
        tokio::time::sleep(Duration::from_millis(80)).await;

        engine.on_control(&ControlEvent { x: 3, y: 3, value: 0.8, kind: ControlKind::Knob, released: false });
        assert_eq!(global_once(&engine, "fader.gain", "80").await.as_deref(), Some("80"));
        let value = profile.lock().profile.page(DEFAULT_PAGE_ID).unwrap().faders[0].value;
        // The hardware value arrives as an f32 fraction, so compare loosely.
        assert!((value - 80.0).abs() < 1e-4, "the slider was moved to 80, the profile says {value}");

        // And again the other way round: hand, then hardware, in quick succession.
        assert!(engine.set_fader_level("gain", 10.0, false));
        engine.on_control(&ControlEvent { x: 3, y: 3, value: 0.35, kind: ControlKind::Knob, released: false });
        assert_eq!(global_once(&engine, "fader.gain", "35").await.as_deref(), Some("35"));
        let value = profile.lock().profile.page(DEFAULT_PAGE_ID).unwrap().faders[0].value;
        assert!((value - 35.0).abs() < 1e-4, "the slider was moved to 35, the profile says {value}");
    }

    #[tokio::test]
    async fn stale_fader_variables_are_pruned() {
        let (engine, profile) = engine();
        profile.lock().profile.page_mut(DEFAULT_PAGE_ID).unwrap().set_fader(Fader { id: "f9".into(), name: "Rolladen 1".into(), length: 3, ..Fader::default() });
        engine.set_globals(HashMap::from([
            ("fader.f9".into(), "1".into()),
            ("fader.Rolladen_1".into(), "1".into()),
            ("fader.old name".into(), "2".into()),
            ("fader.deadbeef".into(), "3".into()),
            ("count".into(), "4".into()),
        ]));
        assert_eq!(engine.prune_fader_variables(), 2);
        let left = engine.globals();
        assert!(left.contains_key("fader.f9") && left.contains_key("fader.Rolladen_1") && left.contains_key("count"));
        assert!(!left.contains_key("fader.old name") && !left.contains_key("fader.deadbeef"));
        assert_eq!(engine.prune_fader_variables(), 0);
        assert_eq!(engine.remove_globals(&["count".into()]), 1);
        engine.clear_globals();
        assert!(engine.globals().is_empty());
    }

    #[tokio::test]
    async fn fader_follows_its_variable_and_the_set_fader_action() {
        let (engine, profile) = engine();
        {
            let mut store = profile.lock();
            let page = store.profile.page_mut(DEFAULT_PAGE_ID).unwrap();
            page.set_fader(Fader {
                id: "f2".into(),
                name: "mic".into(),
                x: 3,
                y: 0,
                direction: FaderDirection::Up,
                length: 5,
                min: -60.0,
                max: 0.0,
                on_change: vec![a(ActionKind::SetVariable { name: "applied".into(), value: "{{value}}".into(), scope: VarScope::Global })],
                ..Fader::default()
            });
            // A button that nudges the fader through its variable, and one that sets it silently.
            page.set(0, 0, Button { down: vec![a(ActionKind::AddToVariable { name: "fader.mic".into(), amount: "-20".into(), scope: VarScope::Global })], ..Default::default() });
            page.set(1, 0, Button { down: vec![a(ActionKind::SetFader { fader: "mic".into(), value: "-6".into(), run_actions: false })], ..Default::default() });
        }
        let press = |x: u8| ButtonEvent { x, y: 0, pressed: true, note: 0, cc: false, value: 100 };
        engine.on_button(&press(0));
        tokio::time::sleep(Duration::from_millis(150)).await;
        assert_eq!(profile.lock().profile.page(DEFAULT_PAGE_ID).unwrap().faders[0].value, -20.0);
        assert_eq!(engine.globals().get("applied").map(String::as_str), Some("-20"), "the fader's actions ran");
        engine.globals_mut_for_test(|g| {
            g.remove("applied");
        });
        engine.on_button(&press(1));
        tokio::time::sleep(Duration::from_millis(150)).await;
        assert_eq!(profile.lock().profile.page(DEFAULT_PAGE_ID).unwrap().faders[0].value, -6.0);
        assert_eq!(engine.globals().get("fader.mic").map(String::as_str), Some("-6"));
        assert!(engine.globals().get("applied").is_none(), "run actions was off");
    }

    #[tokio::test]
    async fn hold_without_waiting_runs_pressed_at_once_and_held_on_top() {
        let (engine, profile) = engine();
        {
            let mut store = profile.lock();
            let page = store.profile.page_mut(DEFAULT_PAGE_ID).unwrap();
            page.set(
                2,
                2,
                Button {
                    down: vec![a(ActionKind::SetVariable { name: "down".into(), value: "yes".into(), scope: VarScope::Global })],
                    hold: vec![a(ActionKind::SetVariable { name: "hold".into(), value: "yes".into(), scope: VarScope::Global })],
                    hold_ms: 80,
                    hold_wait: false,
                    ..Default::default()
                },
            );
        }
        let ev = |pressed: bool| ButtonEvent { x: 2, y: 2, pressed, note: 0, cc: false, value: 100 };
        engine.on_button(&ev(true));
        tokio::time::sleep(Duration::from_millis(30)).await;
        assert_eq!(engine.globals().get("down").map(String::as_str), Some("yes"), "pressed actions run immediately");
        assert!(engine.globals().get("hold").is_none());
        tokio::time::sleep(Duration::from_millis(120)).await;
        assert_eq!(engine.globals().get("hold").map(String::as_str), Some("yes"), "held actions follow after the hold time");
        engine.on_button(&ev(false));
        // A short press never reaches the held list.
        engine.globals_mut_for_test(|g| g.clear());
        engine.on_button(&ev(true));
        engine.on_button(&ev(false));
        tokio::time::sleep(Duration::from_millis(150)).await;
        assert_eq!(engine.globals().get("down").map(String::as_str), Some("yes"));
        assert!(engine.globals().get("hold").is_none());
    }

    #[tokio::test]
    async fn hold_tells_a_tap_from_a_long_press() {
        let (engine, profile) = engine();
        {
            let mut store = profile.lock();
            let page = store.profile.page_mut(DEFAULT_PAGE_ID).unwrap();
            page.set(
                1,
                1,
                Button {
                    down: vec![a(ActionKind::SetVariable { name: "last".into(), value: "tap".into(), scope: VarScope::Global })],
                    hold: vec![a(ActionKind::SetVariable { name: "last".into(), value: "hold".into(), scope: VarScope::Global })],
                    hold_ms: 80,
                    ..Default::default()
                },
            );
        }
        let ev = |pressed: bool| ButtonEvent { x: 1, y: 1, pressed, note: 0, cc: false, value: 100 };
        // Short press: the down list runs on release.
        engine.on_button(&ev(true));
        engine.on_button(&ev(false));
        tokio::time::sleep(Duration::from_millis(150)).await;
        assert_eq!(engine.globals().get("last").map(String::as_str), Some("tap"));
        // Long press: the hold list runs at the hold time, the down list never.
        engine.on_button(&ev(true));
        tokio::time::sleep(Duration::from_millis(160)).await;
        assert_eq!(engine.globals().get("last").map(String::as_str), Some("hold"));
        engine.globals_mut_for_test(|g| g.clear());
        engine.on_button(&ev(false));
        tokio::time::sleep(Duration::from_millis(60)).await;
        assert!(engine.globals().get("last").is_none(), "release after a long press must not run the tap actions");
    }

    #[tokio::test]
    async fn delay_runs_and_finishes() {
        let (engine, profile) = engine();
        set_button(&profile, 0, 0, vec![a(ActionKind::Delay { ms: 20, ms_from: None })], vec![], false);
        let rx = engine.start(DEFAULT_PAGE_ID, 0, 0, ActionList::Down, 127, 0, None).unwrap();
        assert_eq!(engine.running().len(), 1);
        wait_done(rx).await;
        assert!(engine.running().is_empty());
    }

    #[tokio::test]
    async fn set_color_targets_other_button_and_switch_page() {
        let (engine, profile) = engine();
        {
            let mut store = profile.lock();
            store.profile.pages.push(crate::profile::Page::new("p2", "Two"));
            store.profile.page_mut("p2").unwrap().set(3, 3, Button::default());
        }
        set_button(
            &profile,
            0,
            0,
            vec![
                a(ActionKind::SetColor { color: PadColor::Palette { index: 5 }, target: Some(ButtonRef { page_id: Some("p2".into()), x: 3, y: 3 }) }),
                a(ActionKind::SetColor { color: PadColor::Palette { index: 9 }, target: None }),
                a(ActionKind::SwitchPage { page_id: "p2".into() }),
            ],
            vec![],
            false,
        );
        let rx = engine.start(DEFAULT_PAGE_ID, 0, 0, ActionList::Down, 100, 0, None).unwrap();
        wait_done(rx).await;
        let store = profile.lock();
        assert_eq!(store.profile.page("p2").unwrap().get(3, 3).unwrap().color, PadColor::Palette { index: 5 });
        assert_eq!(store.profile.page(DEFAULT_PAGE_ID).unwrap().get(0, 0).unwrap().color, PadColor::Palette { index: 9 });
        assert_eq!(store.profile.active_page, "p2");
    }

    #[tokio::test]
    async fn loop_until_stop_this_on_release() {
        let (engine, profile) = engine();
        set_button(&profile, 1, 1, vec![a(ActionKind::Delay { ms: 5, ms_from: None })], vec![a(ActionKind::StopThisMacro)], true);
        let rx = engine.start(DEFAULT_PAGE_ID, 1, 1, ActionList::Down, 127, 0, None).unwrap();
        tokio::time::sleep(Duration::from_millis(40)).await;
        assert_eq!(engine.running().len(), 1, "still looping");
        let up = engine.start(DEFAULT_PAGE_ID, 1, 1, ActionList::Up, 0, 0, None).unwrap();
        wait_done(up).await;
        tokio::time::timeout(Duration::from_millis(200), wait_done(rx)).await.expect("loop stopped by release");
        assert!(engine.running().is_empty());
    }

    #[tokio::test]
    async fn restart_keeps_newest_runner() {
        let (engine, profile) = engine();
        set_button(&profile, 2, 2, vec![a(ActionKind::RestartThisMacro), a(ActionKind::Delay { ms: 60, ms_from: None })], vec![], false);
        let first = engine.start(DEFAULT_PAGE_ID, 2, 2, ActionList::Down, 127, 0, None).unwrap();
        tokio::time::sleep(Duration::from_millis(10)).await;
        let second = engine.start(DEFAULT_PAGE_ID, 2, 2, ActionList::Down, 127, 0, None).unwrap();
        tokio::time::timeout(Duration::from_millis(50), wait_done(first)).await.expect("first runner cancelled by restart");
        assert_eq!(engine.running().len(), 1);
        wait_done(second).await;
    }

    #[tokio::test]
    async fn flip_flop_alternates_and_persists() {
        let (engine, profile) = engine();
        let start = a(ActionKind::FlipFlopStart { middle_id: "m".into(), end_id: "e".into(), is_a: true });
        let start_id = start.id.clone();
        let middle = Action { id: "m".into(), wait: true, kind: ActionKind::FlipFlopMiddle { start_id: start_id.clone(), end_id: "e".into() } };
        let end = Action { id: "e".into(), wait: true, kind: ActionKind::FlipFlopEnd { start_id: start_id.clone(), middle_id: "m".into() } };
        set_button(
            &profile,
            4,
            4,
            vec![
                start,
                a(ActionKind::SetColor { color: PadColor::Palette { index: 1 }, target: None }),
                middle,
                a(ActionKind::SetColor { color: PadColor::Palette { index: 2 }, target: None }),
                end,
            ],
            vec![],
            false,
        );
        let color = |profile: &SharedProfile| profile.lock().profile.page(DEFAULT_PAGE_ID).unwrap().get(4, 4).unwrap().color;
        wait_done(engine.start(DEFAULT_PAGE_ID, 4, 4, ActionList::Down, 127, 0, None).unwrap()).await;
        assert_eq!(color(&profile), PadColor::Palette { index: 1 }, "branch A first");
        wait_done(engine.start(DEFAULT_PAGE_ID, 4, 4, ActionList::Down, 127, 0, None).unwrap()).await;
        assert_eq!(color(&profile), PadColor::Palette { index: 2 }, "branch B second");
        wait_done(engine.start(DEFAULT_PAGE_ID, 4, 4, ActionList::Down, 127, 0, None).unwrap()).await;
        assert_eq!(color(&profile), PadColor::Palette { index: 1 }, "back to A");
    }

    #[tokio::test]
    async fn branches_follow_the_variable() {
        let (engine, profile) = engine();
        let (s, e, n) = ("if1".to_string(), "else1".to_string(), "end1".to_string());
        let list = |value: &str| {
            vec![
                a(ActionKind::SetVariable { name: "mode".into(), value: value.into(), scope: VarScope::Local }),
                Action { id: s.clone(), wait: true, kind: ActionKind::IfStart { variable: "mode".into(), op: CompareOp::Equals, value: "hot".into(), else_id: e.clone(), end_id: n.clone() } },
                a(ActionKind::SetColor { color: PadColor::Palette { index: 5 }, target: None }),
                Action { id: e.clone(), wait: true, kind: ActionKind::IfElse { start_id: s.clone(), end_id: n.clone() } },
                a(ActionKind::SetColor { color: PadColor::Palette { index: 45 }, target: None }),
                Action { id: n.clone(), wait: true, kind: ActionKind::IfEnd { start_id: s.clone(), else_id: e.clone() } },
                a(ActionKind::SetVariable { name: "after".into(), value: "yes".into(), scope: VarScope::Global }),
            ]
        };
        let color = |profile: &SharedProfile| profile.lock().profile.page(DEFAULT_PAGE_ID).unwrap().get(1, 2).unwrap().color;

        set_button(&profile, 1, 2, list("hot"), vec![], false);
        wait_done(engine.start(DEFAULT_PAGE_ID, 1, 2, ActionList::Down, 127, 0, None).unwrap()).await;
        assert_eq!(color(&profile), PadColor::Palette { index: 5 }, "true branch");

        set_button(&profile, 1, 2, list("cold"), vec![], false);
        wait_done(engine.start(DEFAULT_PAGE_ID, 1, 2, ActionList::Down, 127, 0, None).unwrap()).await;
        assert_eq!(color(&profile), PadColor::Palette { index: 45 }, "false branch");
        assert_eq!(engine.globals().get("after").map(String::as_str), Some("yes"), "actions after the branch always run");
    }

    #[tokio::test]
    async fn run_button_waits_for_target_and_refuses_deep_recursion() {
        let (engine, profile) = engine();
        set_button(&profile, 5, 5, vec![a(ActionKind::Delay { ms: 30, ms_from: None }), a(ActionKind::SetColor { color: PadColor::Palette { index: 7 }, target: None })], vec![], false);
        set_button(
            &profile,
            6,
            6,
            vec![a(ActionKind::RunButton { target: ButtonRef { page_id: None, x: 5, y: 5 }, trigger: ButtonTrigger::Press })],
            vec![],
            false,
        );
        let started = Instant::now();
        wait_done(engine.start(DEFAULT_PAGE_ID, 6, 6, ActionList::Down, 127, 0, None).unwrap()).await;
        assert!(started.elapsed() >= Duration::from_millis(25), "caller waited for the callee");
        assert_eq!(profile.lock().profile.page(DEFAULT_PAGE_ID).unwrap().get(5, 5).unwrap().color, PadColor::Palette { index: 7 });

        // A button calling itself stops at the depth limit instead of running forever.
        set_button(
            &profile,
            7,
            7,
            vec![a(ActionKind::RunButton { target: ButtonRef { page_id: None, x: 7, y: 7 }, trigger: ButtonTrigger::Press })],
            vec![],
            false,
        );
        tokio::time::timeout(Duration::from_secs(2), wait_done(engine.start(DEFAULT_PAGE_ID, 7, 7, ActionList::Down, 127, 0, None).unwrap()))
            .await
            .expect("recursion terminated");
    }

    #[tokio::test]
    async fn stop_all_cancels_everything_and_no_wait_runs_concurrently() {
        let (engine, profile) = engine();
        let mut slow = a(ActionKind::Delay { ms: 40, ms_from: None });
        slow.wait = false;
        set_button(&profile, 0, 1, vec![slow, a(ActionKind::Delay { ms: 40, ms_from: None })], vec![], false);
        let started = Instant::now();
        let rx = engine.start(DEFAULT_PAGE_ID, 0, 1, ActionList::Down, 127, 0, None).unwrap();
        wait_done(rx).await;
        assert!(started.elapsed() < Duration::from_millis(75), "no-wait action overlapped the next one");

        set_button(&profile, 0, 2, vec![a(ActionKind::Delay { ms: 500, ms_from: None })], vec![], false);
        let rx = engine.start(DEFAULT_PAGE_ID, 0, 2, ActionList::Down, 127, 0, None).unwrap();
        engine.stop_all();
        tokio::time::timeout(Duration::from_millis(100), wait_done(rx)).await.expect("stopped");
    }

    /// A script's runner must not hold the profile lock while it gathers what
    /// `Lunchpad` describes: `script_info` locked the profile and then asked
    /// `press()` to lock it again, so the runner froze forever and everything
    /// that needed the profile afterwards (UI, MIDI, other macros) froze with it.
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn a_script_finishes_and_runs_what_it_queued() {
        let (engine, profile) = engine();
        set_button(&profile, 5, 5, vec![a(ActionKind::SetColor { color: PadColor::Palette { index: 7 }, target: None })], vec![], false);
        let code = "Lunchpad.runButton(5, 5, { trigger: 'press' }); globals.seen = Lunchpad.button.x + ':' + Lunchpad.button.y; 1";
        set_button(&profile, 6, 6, vec![a(ActionKind::RunScript { code: code.into(), save_to: Some("result".into()), save_scope: VarScope::Global })], vec![], false);
        let rx = engine.start(DEFAULT_PAGE_ID, 6, 6, ActionList::Down, 127, 0, None).unwrap();
        tokio::time::timeout(Duration::from_secs(5), wait_done(rx)).await.expect("the script's runner finished");
        assert_eq!(engine.globals().get("result").map(String::as_str), Some("1"));
        assert_eq!(engine.globals().get("seen").map(String::as_str), Some("6:6"));
        assert_eq!(profile.lock().profile.page(DEFAULT_PAGE_ID).unwrap().get(5, 5).unwrap().color, PadColor::Palette { index: 7 });
    }

    /// The settings' variables list: a value set by hand is published, provided
    /// and unusable names are refused, and a fader follows its variable quietly.
    #[tokio::test]
    async fn a_variable_set_by_hand_is_published_and_moves_its_fader_quietly() {
        let (engine, profile) = engine();
        profile.lock().profile.page_mut(DEFAULT_PAGE_ID).unwrap().set_fader(Fader {
            id: "f3".into(),
            name: "mic".into(),
            x: 3,
            y: 0,
            direction: FaderDirection::Up,
            length: 5,
            min: -60.0,
            max: 0.0,
            on_change: vec![a(ActionKind::SetVariable { name: "applied".into(), value: "{{value}}".into(), scope: VarScope::Global })],
            ..Fader::default()
        });
        engine.set_global(" greeting ", "hi".into()).unwrap();
        assert_eq!(engine.globals().get("greeting").map(String::as_str), Some("hi"));
        engine.set_global("greeting", "bye".into()).unwrap();
        assert_eq!(engine.globals().get("greeting").map(String::as_str), Some("bye"));
        assert!(engine.set_global("velocity", "1".into()).is_err(), "provided names are refused");
        assert!(engine.set_global("  ", "1".into()).is_err(), "an empty name is refused");
        assert!(engine.set_global("my var", "1".into()).is_err(), "a name with a space cannot be a placeholder");
        assert!(engine.globals().get("velocity").is_none());
        engine.set_global("fader.mic", "-20".into()).unwrap();
        tokio::time::sleep(Duration::from_millis(100)).await;
        assert_eq!(profile.lock().profile.page(DEFAULT_PAGE_ID).unwrap().faders[0].value, -20.0);
        assert_eq!(engine.globals().get("fader.mic").map(String::as_str), Some("-20"));
        assert!(engine.globals().get("applied").is_none(), "the fader's actions did not run");
    }

    /// The "wait" switch of a launch: on, the list waits until the program ends; off,
    /// the next action runs right after the start and the runner lasts as long as the
    /// program does. An app on macOS goes the same way (`open -W`).
    #[cfg(unix)]
    #[tokio::test]
    async fn a_launch_waits_for_the_program_only_when_asked_to() {
        let (engine, profile) = engine();
        let launch = |wait: bool| {
            let mut l = a(ActionKind::LaunchApplication { executable: "sleep".into(), arguments: "0.3".into(), hidden: false, kill_on_stop: false, save_output_to: None, save_scope: VarScope::Local });
            l.wait = wait;
            l
        };
        let mark = |name: &str| a(ActionKind::SetVariable { name: name.into(), value: "1".into(), scope: VarScope::Global });
        set_button(&profile, 0, 0, vec![launch(true), mark("after_wait")], vec![], false);
        set_button(&profile, 1, 1, vec![launch(false), mark("after_start")], vec![], false);

        let started = Instant::now();
        let rx = engine.start(DEFAULT_PAGE_ID, 0, 0, ActionList::Down, 127, 0, None).unwrap();
        assert_eq!(global_once(&engine, "after_wait", "1").await.as_deref(), Some("1"));
        assert!(started.elapsed() >= Duration::from_millis(250), "with wait on, the next action came after the program ended");
        wait_done(rx).await;

        let started = Instant::now();
        let rx = engine.start(DEFAULT_PAGE_ID, 1, 1, ActionList::Down, 127, 0, None).unwrap();
        assert_eq!(global_once(&engine, "after_start", "1").await.as_deref(), Some("1"));
        assert!(started.elapsed() < Duration::from_millis(250), "with wait off, the next action ran right after the start");
        assert!(!engine.running().is_empty(), "the runner lasts as long as the program");
        wait_done(rx).await;
        assert!(started.elapsed() >= Duration::from_millis(250), "and ends with it");
    }

    /// A script hands back every global it saw; only the ones it changed count.
    /// An untouched `fader.*` value must not move that fader (and run its actions
    /// again) just because the level reads differently as rounded text.
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn a_script_leaves_untouched_fader_variables_alone() {
        let (engine, profile) = engine();
        profile.lock().profile.page_mut(DEFAULT_PAGE_ID).unwrap().set_fader(Fader {
            id: "knob1".into(),
            name: "aux".into(),
            x: 3,
            y: 3,
            length: 1,
            min: 1.0,
            max: 20.0,
            decimals: 0,
            on_change: vec![a(ActionKind::RunScript {
                code: "globals.runs = String(Number(globals.runs || 0) + 1); globals.mark = 'x'".into(),
                save_to: None,
                save_scope: VarScope::Global,
            })],
            ..Fader::default()
        });
        // 1 + 19 * 0.3 = 6.7 reads "7": written back, it would move the fader to 7 and run it again.
        engine.on_control(&ControlEvent { x: 3, y: 3, value: 0.3, kind: ControlKind::Knob, released: false });
        assert_eq!(global_once(&engine, "runs", "1").await.as_deref(), Some("1"));
        tokio::time::sleep(Duration::from_millis(400)).await;
        assert_eq!(engine.globals().get("runs").map(String::as_str), Some("1"), "the fader's actions ran once");
        assert_eq!(engine.globals().get("mark").map(String::as_str), Some("x"));
        assert_eq!(engine.globals().get("fader.aux").map(String::as_str), Some("7"));
        let value = profile.lock().profile.page(DEFAULT_PAGE_ID).unwrap().faders[0].value;
        assert!((value - 6.7).abs() < 1e-3, "the fader kept its level, got {value}");
    }
}
