//! LED renderer: paints the active page on the device.
//!
//! One render thread per connection. Anyone can ask for a repaint by sending
//! [`RenderCmd::Repaint`]; requests are coalesced and only LEDs whose colour
//! changed since the last frame are sent. [`RenderCmd::Reset`] forgets the
//! last frame (used after the wake-up sweep or a manual clear) so the next
//! paint is complete.

use super::manager::OutputHandle;
use super::types::*;
use crate::live::{LiveStatus, SharedLive};
use crate::profile::ProfileStore;
use crossbeam_channel::{unbounded, Receiver, Sender};
use parking_lot::Mutex;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;

/// Colour for a held pad that has no button (connection check).
pub const PRESS_COLOR: Color = Color::new(255, 122, 26);
/// Legacy lit the logo LED of X / Pro MK3 as a soft "app is driving me" hint.
const LOGO_COLOR: LedColor = LedColor::Pulsing(45);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RenderCmd {
    Repaint,
    Reset,
    Close,
}

/// Everything the renderer reads to build a frame.
#[derive(Clone)]
pub struct RenderInputs {
    pub profile: Arc<Mutex<ProfileStore>>,
    pub pressed: Arc<Mutex<HashSet<(u8, u8)>>>,
    /// (page, x, y) of every running macro
    pub running: Arc<Mutex<HashSet<(String, u8, u8)>>>,
    pub press_feedback: Arc<Mutex<bool>>,
    /// Streaming app state for buttons with a `state_link`.
    pub live: SharedLive,
}

#[derive(Clone)]
pub struct RenderHandle {
    tx: Sender<RenderCmd>,
}

impl RenderHandle {
    pub fn repaint(&self) {
        let _ = self.tx.send(RenderCmd::Repaint);
    }
    pub fn reset(&self) {
        let _ = self.tx.send(RenderCmd::Reset);
    }
    pub fn close(&self) {
        let _ = self.tx.send(RenderCmd::Close);
    }
}

pub fn spawn_renderer(output: OutputHandle, layout: Layout, inputs: RenderInputs) -> RenderHandle {
    let (tx, rx) = unbounded::<RenderCmd>();
    std::thread::Builder::new()
        .name("lunchpad-led-render".into())
        .spawn(move || render_loop(rx, output, layout, inputs))
        .expect("failed to spawn LED render thread");
    RenderHandle { tx }
}

fn render_loop(rx: Receiver<RenderCmd>, output: OutputHandle, layout: Layout, inputs: RenderInputs) {
    let mut last: HashMap<(u8, u8), LedColor> = HashMap::new();
    while let Ok(mut cmd) = rx.recv() {
        // Coalesce a burst of requests into one frame.
        while let Ok(next) = rx.try_recv() {
            cmd = match (cmd, next) {
                (RenderCmd::Close, _) | (_, RenderCmd::Close) => RenderCmd::Close,
                (RenderCmd::Reset, _) | (_, RenderCmd::Reset) => RenderCmd::Reset,
                _ => RenderCmd::Repaint,
            };
        }
        match cmd {
            RenderCmd::Close => break,
            RenderCmd::Reset => last.clear(),
            RenderCmd::Repaint => {}
        }
        let frame = build_frame(&layout, &inputs);
        let changed: Vec<(u8, u8, LedColor)> = frame
            .iter()
            .filter(|((x, y), c)| last.get(&(*x, *y)) != Some(*c))
            .map(|((x, y), c)| (*x, *y, *c))
            .collect();
        if changed.is_empty() {
            continue;
        }
        tracing::trace!(leds = changed.len(), "painting");
        if output.set_leds(&changed).is_err() {
            break;
        }
        last = frame;
    }
    tracing::debug!("LED render thread finished");
}

/// Compute the colour of every LED for the current profile state.
pub fn build_frame(layout: &Layout, inputs: &RenderInputs) -> HashMap<(u8, u8), LedColor> {
    let profile = inputs.profile.lock();
    let page = profile.profile.active();
    let pressed = inputs.pressed.lock().clone();
    // Only macros of the page on the device light their pad.
    let running: HashSet<(u8, u8)> = {
        let all = inputs.running.lock();
        let active_id = page.map(|p| p.id.as_str());
        all.iter().filter(|(p, _, _)| Some(p.as_str()) == active_id).map(|(_, x, y)| (*x, *y)).collect()
    };
    let feedback = *inputs.press_feedback.lock();
    let live: LiveStatus = inputs.live.lock().clone();

    let mut frame = HashMap::with_capacity(layout.pads.len());
    for pad in &layout.pads {
        if pad.led == LedKind::None {
            continue;
        }
        let color = match pad.shape {
            PadShape::Empty => continue,
            PadShape::Logo => LOGO_COLOR,
            _ => {
                if let Some((fader, step)) = page.and_then(|p| p.fader_at(pad.x, pad.y)) {
                    let [r, g, b] = fader.pad_rgb(step);
                    frame.insert((pad.x, pad.y), if r == 0 && g == 0 && b == 0 { LedColor::Off } else { LedColor::Rgb(Color::new(r, g, b)) });
                    continue;
                }
                let active = pressed.contains(&(pad.x, pad.y)) || running.contains(&(pad.x, pad.y));
                match page.and_then(|p| p.get(pad.x, pad.y)) {
                    Some(button) => {
                        let linked = button.state_link.as_ref().map(|l| l.is_active(&live)).unwrap_or(false);
                        let c = if active || linked { button.active_color.unwrap_or(button.color) } else { button.color };
                        pad_color_to_led(c)
                    }
                    None if active && feedback => LedColor::Rgb(PRESS_COLOR),
                    None => LedColor::Off,
                }
            }
        };
        frame.insert((pad.x, pad.y), color);
    }
    frame
}

fn pad_color_to_led(c: crate::profile::PadColor) -> LedColor {
    use crate::profile::PadColor;
    match c {
        PadColor::Palette { index } => {
            if index == 0 {
                LedColor::Off
            } else {
                LedColor::Palette(index)
            }
        }
        PadColor::Flashing { index, alt } => LedColor::Flashing { index, alt },
        PadColor::Pulsing { index } => LedColor::Pulsing(index),
        PadColor::Rgb { r, g, b } => {
            if r == 0 && g == 0 && b == 0 {
                LedColor::Off
            } else {
                LedColor::Rgb(Color::new(r, g, b))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::midi::models::driver_for;
    use crate::profile::{Button, PadColor};

    fn inputs() -> RenderInputs {
        let dir = std::env::temp_dir().join(format!("lunchpad-render-{}", uuid::Uuid::new_v4()));
        RenderInputs {
            profile: Arc::new(Mutex::new(ProfileStore::load(&dir))),
            pressed: Arc::new(Mutex::new(HashSet::new())),
            running: Arc::new(Mutex::new(HashSet::new())),
            press_feedback: Arc::new(Mutex::new(true)),
            live: Default::default(),
        }
    }

    #[test]
    fn frame_uses_active_color_while_pressed() {
        let inputs = inputs();
        {
            let mut store = inputs.profile.lock();
            let page = store.profile.pages.first_mut().unwrap();
            page.set(0, 0, Button { color: PadColor::Palette { index: 5 }, active_color: Some(PadColor::Palette { index: 21 }), ..Default::default() });
        }
        let layout = driver_for(LaunchpadModel::LaunchpadMk2).layout();
        let frame = build_frame(&layout, &inputs);
        assert_eq!(frame[&(0, 0)], LedColor::Palette(5));
        assert_eq!(frame[&(1, 0)], LedColor::Off);
        assert!(!frame.contains_key(&(8, 8)), "empty corner has no LED");

        inputs.pressed.lock().insert((0, 0));
        inputs.pressed.lock().insert((1, 0));
        let frame = build_frame(&layout, &inputs);
        assert_eq!(frame[&(0, 0)], LedColor::Palette(21));
        assert_eq!(frame[&(1, 0)], LedColor::Rgb(PRESS_COLOR), "held empty pad shows press feedback");
    }
}
