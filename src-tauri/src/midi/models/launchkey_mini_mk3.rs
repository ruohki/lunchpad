//! Launchkey Mini MK3 driver (DAW mode over the DAW port).
//!
//! References: Novation "Launchkey MK3 Programmer's Reference" (the Mini shares
//! its DAW protocol) and the community MIDI notes for the Mini; Novation has
//! not published a Mini-specific programmer's guide. Not yet verified on
//! hardware in this rewrite.
//!
//! Enter DAW mode with `9F 0C 7F`, leave it with `9F 0C 00`. In Session pad
//! mode the 16 pads are Note 96..103 (top row) and 112..119 (bottom row) on
//! channel 1; their LEDs take a palette index as the velocity on channel 1
//! (solid), 2 (flashing) or 3 (pulsing). The scene buttons ">" and "Stop Solo
//! Mute" are CC 104 / 105 on channel 1 with the same LED scheme. Play and
//! Record are CC 115 / 117 on channel 16 with a white LED set by a brightness
//! on channel 16. Shift is CC 108 on channel 16 and has no LED. The eight
//! knobs send CC 21..28 on channel 16 (0..127) and become control events.
//! Transpose, Octave, Arp and Fixed Chord are keyboard functions that report
//! nothing in DAW mode; the pitch and modulation strips report on the MIDI
//! port and are not read yet.
//!
//! Logical layout (x from the left, y from the bottom), 14 x 4:
//!   y = 3  strips (0, 1, spanning down)  Shift (2)  knobs (3..10)
//!   y = 2  Transpose (2)  pads (3..10)  ">" (11)  Arp (12)  Fixed Chord (13)
//!   y = 1  Octave + (2)   pads (3..10)  SSM (11)  Play (12)  Record (13)
//!   y = 0  Octave − (2)

use super::{spec, LaunchpadDriver};
use crate::midi::palette::{nearest_palette_index, palette_color};
use crate::midi::types::*;

const PAD_X0: u8 = 3;
const PAD_TOP_Y: u8 = 2;
const PAD_BOTTOM_Y: u8 = 1;
const KNOB_Y: u8 = 3;
const CC_SCENE_UP: u8 = 104;
const CC_SCENE_DOWN: u8 = 105;
const CC_SHIFT: u8 = 108;
const CC_PLAY: u8 = 115;
const CC_RECORD: u8 = 117;
const CC_KNOB_FIRST: u8 = 21;
const KNOB_LABELS: [&str; 8] = ["1", "2", "3", "4", "5", "6", "7", "8"];

pub struct LaunchkeyMiniMk3;

/// Which MIDI channel status a control's LED listens on: note-style pads, CC
/// buttons on channel 1, or the white CC buttons on channel 16.
enum Led {
    Pad(u8),
    SceneButton(u8),
    White(u8),
}

fn led_of(x: u8, y: u8) -> Option<Led> {
    match (x, y) {
        (PAD_X0..=10, PAD_TOP_Y) => Some(Led::Pad(96 + (x - PAD_X0))),
        (PAD_X0..=10, PAD_BOTTOM_Y) => Some(Led::Pad(112 + (x - PAD_X0))),
        (11, PAD_TOP_Y) => Some(Led::SceneButton(CC_SCENE_UP)),
        (11, PAD_BOTTOM_Y) => Some(Led::SceneButton(CC_SCENE_DOWN)),
        (12, PAD_BOTTOM_Y) => Some(Led::White(CC_PLAY)),
        (13, PAD_BOTTOM_Y) => Some(Led::White(CC_RECORD)),
        _ => None,
    }
}

/// Brightness 0..127 of a colour for a single white LED.
fn brightness(c: Color) -> u8 {
    ((0.2126 * c.r as f32 + 0.7152 * c.g as f32 + 0.0722 * c.b as f32) / 2.0).round().clamp(0.0, 127.0) as u8
}

impl LaunchpadDriver for LaunchkeyMiniMk3 {
    fn model(&self) -> LaunchpadModel {
        LaunchpadModel::LaunchkeyMiniMk3
    }

    fn layout(&self) -> Layout {
        let mut pads = Vec::with_capacity(56);
        for y in (0..4u8).rev() {
            for x in 0..14u8 {
                let p = match (x, y) {
                    (0, 3) => spec(self, x, y, PadShape::Strip, PadRegion::Left, Some("Pitch")).with_rows(4),
                    (1, 3) => spec(self, x, y, PadShape::Strip, PadRegion::Left, Some("Mod")).with_rows(4),
                    (0 | 1, _) => continue,
                    (2, 3) => spec(self, x, y, PadShape::Small, PadRegion::Left, Some("Shift")).with_led(LedKind::None),
                    (2, 2) => spec(self, x, y, PadShape::Small, PadRegion::Left, Some("Transpose")).with_led(LedKind::None).without_input(),
                    (2, 1) => spec(self, x, y, PadShape::Small, PadRegion::Left, Some("Oct +")).with_led(LedKind::None).without_input(),
                    (2, 0) => spec(self, x, y, PadShape::Small, PadRegion::Left, Some("Oct −")).with_led(LedKind::None).without_input(),
                    (PAD_X0..=10, KNOB_Y) => spec(self, x, y, PadShape::Knob, PadRegion::Top, Some(KNOB_LABELS[(x - PAD_X0) as usize])),
                    (PAD_X0..=10, PAD_TOP_Y | PAD_BOTTOM_Y) => spec(self, x, y, PadShape::Pad, PadRegion::Grid, None),
                    (11, PAD_TOP_Y) => spec(self, x, y, PadShape::Round, PadRegion::Right, Some("▶")),
                    (11, PAD_BOTTOM_Y) => spec(self, x, y, PadShape::Round, PadRegion::Right, Some("Stop Solo Mute")),
                    (12, PAD_TOP_Y) => spec(self, x, y, PadShape::Small, PadRegion::Right, Some("Arp")).with_led(LedKind::None).without_input(),
                    (13, PAD_TOP_Y) => spec(self, x, y, PadShape::Small, PadRegion::Right, Some("Fixed Chord")).with_led(LedKind::None).without_input(),
                    (12, PAD_BOTTOM_Y) => spec(self, x, y, PadShape::Round, PadRegion::Right, Some("Play")).with_led(LedKind::White),
                    (13, PAD_BOTTOM_Y) => spec(self, x, y, PadShape::Round, PadRegion::Right, Some("Record")).with_led(LedKind::White),
                    _ => spec(self, x, y, PadShape::Empty, PadRegion::Other, None),
                };
                pads.push(p);
            }
        }
        Layout {
            model: self.model(),
            model_name: self.model().display_name().into(),
            width: 14,
            height: 4,
            // The bottom row only holds Octave −; keep it short.
            row_weights: vec![0.6, 1.0, 1.0, 1.0],
            pads,
            limited_color: false,
            velocity_sensitive: true,
        }
    }

    fn init_messages(&self) -> Vec<Vec<u8>> {
        vec![
            // DAW mode on: pads land in Session mode, knobs report on channel 16.
            vec![0x9F, 0x0C, 0x7F],
            // Session pad mode and Pan pot mode, explicitly.
            vec![0xBF, 0x03, 0x02],
            vec![0xBF, 0x09, 0x03],
        ]
    }

    fn unload_messages(&self) -> Vec<Vec<u8>> {
        vec![vec![0x9F, 0x0C, 0x00]]
    }

    fn clear_messages(&self) -> Vec<Vec<u8>> {
        let mut out = Vec::new();
        for note in (96..=103).chain(112..=119) {
            out.push(vec![0x90, note, 0]);
        }
        out.push(vec![0xB0, CC_SCENE_UP, 0]);
        out.push(vec![0xB0, CC_SCENE_DOWN, 0]);
        out.push(vec![0xBF, CC_PLAY, 0]);
        out.push(vec![0xBF, CC_RECORD, 0]);
        out
    }

    fn color_messages(&self, pads: &[(u8, u8, Color)]) -> Vec<Vec<u8>> {
        let leds: Vec<(u8, u8, LedColor)> = pads.iter().map(|(x, y, c)| (*x, *y, if c.r == 0 && c.g == 0 && c.b == 0 { LedColor::Off } else { LedColor::Rgb(*c) })).collect();
        self.led_messages(&leds)
    }

    fn led_messages(&self, leds: &[(u8, u8, LedColor)]) -> Vec<Vec<u8>> {
        let mut out = Vec::with_capacity(leds.len());
        for (x, y, led) in leds {
            let Some(target) = led_of(*x, *y) else { continue };
            match target {
                Led::White(cc) => {
                    let level = match led {
                        LedColor::Off => 0,
                        LedColor::Palette(i) | LedColor::Pulsing(i) | LedColor::Flashing { index: i, .. } => brightness(palette_color(*i)),
                        LedColor::Rgb(c) => brightness(*c),
                    };
                    out.push(vec![0xBF, cc, level]);
                }
                Led::Pad(n) | Led::SceneButton(n) => {
                    let base: u8 = if matches!(target, Led::Pad(_)) { 0x90 } else { 0xB0 };
                    match led {
                        LedColor::Off => out.push(vec![base, n, 0]),
                        LedColor::Palette(i) => out.push(vec![base, n, *i]),
                        LedColor::Rgb(c) => out.push(vec![base, n, nearest_palette_index(*c)]),
                        LedColor::Pulsing(i) => out.push(vec![base + 2, n, *i]),
                        LedColor::Flashing { index, alt } => {
                            out.push(vec![base, n, *index]);
                            out.push(vec![base + 1, n, *alt]);
                        }
                    }
                }
            }
        }
        out
    }

    fn xy_to_note(&self, x: u8, y: u8) -> Option<(u8, bool)> {
        match (x, y) {
            (PAD_X0..=10, PAD_TOP_Y) => Some((96 + (x - PAD_X0), false)),
            (PAD_X0..=10, PAD_BOTTOM_Y) => Some((112 + (x - PAD_X0), false)),
            (PAD_X0..=10, KNOB_Y) => Some((CC_KNOB_FIRST + (x - PAD_X0), true)),
            (11, PAD_TOP_Y) => Some((CC_SCENE_UP, true)),
            (11, PAD_BOTTOM_Y) => Some((CC_SCENE_DOWN, true)),
            (12, PAD_BOTTOM_Y) => Some((CC_PLAY, true)),
            (13, PAD_BOTTOM_Y) => Some((CC_RECORD, true)),
            (2, 3) => Some((CC_SHIFT, true)),
            _ => None,
        }
    }

    fn note_to_xy(&self, note: u8, cc: bool) -> Option<(u8, u8)> {
        if cc {
            match note {
                CC_SCENE_UP => Some((11, PAD_TOP_Y)),
                CC_SCENE_DOWN => Some((11, PAD_BOTTOM_Y)),
                CC_PLAY => Some((12, PAD_BOTTOM_Y)),
                CC_RECORD => Some((13, PAD_BOTTOM_Y)),
                CC_SHIFT => Some((2, 3)),
                21..=28 => Some((PAD_X0 + (note - CC_KNOB_FIRST), KNOB_Y)),
                _ => None,
            }
        } else {
            match note {
                96..=103 => Some((PAD_X0 + (note - 96), PAD_TOP_Y)),
                112..=119 => Some((PAD_X0 + (note - 112), PAD_BOTTOM_Y)),
                _ => None,
            }
        }
    }

    fn press_threshold(&self) -> u8 {
        1
    }

    /// Pads are notes on channel 1; only the button CCs count as presses, the
    /// knob CCs are controls (see `parse_control`), everything else is ignored.
    fn parse_input_with(&self, msg: &[u8], threshold: u8) -> Option<ButtonEvent> {
        if msg.len() < 3 {
            return None;
        }
        let threshold = threshold.max(1);
        let (status, channel, number, value) = (msg[0] & 0xF0, msg[0] & 0x0F, msg[1], msg[2]);
        match (status, channel, number) {
            (0x90 | 0x80, 0, 96..=103 | 112..=119) => {
                if status == 0x90 && value > 0 && value < threshold {
                    return None;
                }
                let (x, y) = self.note_to_xy(number, false)?;
                Some(ButtonEvent { x, y, pressed: status == 0x90 && value >= threshold, note: number, cc: false, value })
            }
            (0xB0, 0, CC_SCENE_UP | CC_SCENE_DOWN) | (0xB0, 15, CC_PLAY | CC_RECORD | CC_SHIFT) => {
                let (x, y) = self.note_to_xy(number, true)?;
                Some(ButtonEvent { x, y, pressed: value > 0, note: number, cc: true, value })
            }
            _ => None,
        }
    }

    fn parse_control(&self, msg: &[u8]) -> Option<ControlEvent> {
        if msg.len() < 3 || msg[0] != 0xBF || !(21..=28).contains(&msg[1]) {
            return None;
        }
        let (x, y) = self.note_to_xy(msg[1], true)?;
        Some(ControlEvent { x, y, value: msg[2].min(127) as f32 / 127.0 })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn launchkey_mapping() {
        let d = LaunchkeyMiniMk3;
        assert_eq!(d.xy_to_note(3, 2), Some((96, false)));
        assert_eq!(d.xy_to_note(10, 1), Some((119, false)));
        assert_eq!(d.note_to_xy(112, false), Some((3, 1)));
        assert_eq!(d.xy_to_note(11, 2), Some((104, true)));
        assert_eq!(d.note_to_xy(117, true), Some((13, 1)));
        assert_eq!(d.xy_to_note(2, 2), None, "Transpose has no DAW message");
        // Presses: pads on channel 1, buttons on their channels, knobs never.
        let pad = d.parse_input_with(&[0x90, 100, 90], 1).unwrap();
        assert_eq!((pad.x, pad.y, pad.pressed, pad.value), (7, 2, true, 90));
        assert!(!d.parse_input_with(&[0x90, 100, 0], 1).unwrap().pressed);
        let play = d.parse_input_with(&[0xBF, 115, 127], 1).unwrap();
        assert_eq!((play.x, play.y, play.pressed), (12, 1, true));
        assert!(d.parse_input_with(&[0xBF, 24, 100], 1).is_none());
        assert!(d.parse_input_with(&[0xB0, 115, 127], 1).is_none(), "Play lives on channel 16");
        let knob = d.parse_control(&[0xBF, 24, 127]).unwrap();
        assert_eq!((knob.x, knob.y), (6, 3));
        assert!((knob.value - 1.0).abs() < 1e-6);
        assert!(d.parse_control(&[0xB0, 24, 127]).is_none());
        // LEDs: pads and scene buttons take palette indices, Play/Record a brightness, the rest nothing.
        let msgs = d.led_messages(&[(3, 2, LedColor::Palette(5)), (11, 1, LedColor::Flashing { index: 5, alt: 21 }), (12, 1, LedColor::Rgb(Color::new(255, 255, 255))), (2, 3, LedColor::Palette(5)), (3, 3, LedColor::Palette(5))]);
        assert_eq!(msgs, vec![vec![0x90, 96, 5], vec![0xB0, 105, 5], vec![0xB1, 105, 21], vec![0xBF, 115, 127]]);
        let layout = d.layout();
        let strip = layout.pads.iter().find(|p| p.x == 0 && p.y == 3).unwrap();
        assert_eq!((strip.shape, strip.rows, strip.led), (PadShape::Strip, 4, LedKind::None));
        assert!(layout.pads.iter().find(|p| p.x == 2 && p.y == 2).unwrap().note.is_none());
        assert_eq!(layout.pads.iter().find(|p| p.x == 12 && p.y == 1).unwrap().led, LedKind::White);
    }
}
