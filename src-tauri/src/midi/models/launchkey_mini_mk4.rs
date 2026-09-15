//! Launchkey Mini MK4 (25 keys) driver: DAW mode over the DAW interface, keys
//! and strips over the MIDI interface.
//!
//! References: Novation "Launchkey MK4 Programmer's Reference Guide" v2
//! (`docs/novation/launchkey_mk4_programmers_reference_guide_v2.md`) and a
//! capture from a Launchkey Mini MK4 25 (firmware 1.1.9.92, 2026-09-14).
//!
//! Enter DAW mode with `9F 0C 7F`, leave it with `9F 0C 00`; the pads are then
//! put in the DAW layout (`B6 1D 02`) and the encoders in Plugin mode
//! (`B6 1E 02`), which reports them as absolute values. The 16 pads are Note
//! 96..103 (top row) and 112..119 (bottom row) on channel 1 and send
//! polyphonic aftertouch; their LEDs take a palette index as the velocity on
//! channel 1 (solid), 2 (flashing) or 3 (pulsing). The buttons beside the
//! pads report as CC on channel 1: ▲ / ▼ (Track up / down) 106 / 107 with
//! colour LEDs on the same numbers, ▶ 115 and ● 117 with a single LED whose
//! brightness is a CC on channel 4. Shift reports as a feature control, CC 63
//! on channel 7, and has no LED. The eight encoders send CC 21..28 on channel
//! 16 (0..127) and become control events. Layout changes made from the Shift
//! menu come back on channel 7 (CC 29 pads, CC 30 encoders) and are ignored;
//! Octave and the other keyboard buttons report nothing in DAW mode.
//!
//! The keys and the two strips arrive on the MIDI interface exactly as on the
//! Mini MK3: Note 48..72 (C2..C4) at the default octave, Pitch Bend (14 bit,
//! back to the centre when released) and CC 1. That interface also streams
//! MIDI clock, which the manager drops.
//!
//! Logical layout, 16 x 7 (x from the left, y from the bottom), following the
//! front panel: the two sliders, the screen over the button block, Arp and
//! Scale, the track arrows, encoders over the pads, and > / Func / the mode
//! arrows on the right. Two half-rows per pad row so the buttons beside the
//! pads sit where they are printed:
//!   y = 6  sliders (0, 1, spanning down to y = 2)  screen (2, 3)  Arp (4)  encoders (6..13)  settings pad (15)
//!   y = 5  Shift (2)  Settings (3)  Scale (4)  ▲ (5, 2 rows)  pads (6..13, 2 rows)  > (14)  ∧ (15)
//!   y = 4
//!   y = 3  ▶ (2)  ● (3)  ▼ (5, 2 rows)  pads (6..13, 2 rows)  Func (14)  ∨ (15)
//!   y = 2  Oct − (2)  Oct + (3)
//!   y = 1  black keys, each at the x of the white key to its left
//!   y = 0  white keys (0..14)
//!
//! Only the controls that were seen in the capture carry input: the pads, the
//! track arrows, ▶, ● and Shift. Settings, Scale, Arp, Oct ±, > , Func and the
//! mode arrows are drawn but send nothing until their CCs are confirmed on
//! hardware (the guide lists Settings 63, prev/next pad mode 75/76, prev/next
//! encoder mode 74/77, and the Mini's extra mode arrows on 55/56).

use super::{spec, LaunchpadDriver};
use crate::midi::palette::{nearest_palette_index, palette_color};
use crate::midi::types::*;

const WIDTH: u8 = 16;
const HEIGHT: u8 = 7;
/// The button block left of the pads, two columns wide: Shift / Settings,
/// ▶ / ●, Oct − / Oct +, with the screen above it.
const BLOCK_L_X: u8 = 2;
const BLOCK_R_X: u8 = 3;
/// Arp and Scale.
const MODE_X: u8 = 4;
/// The Track arrows between the mode buttons and the pads.
const TRACK_X: u8 = 5;
const PAD_X0: u8 = 6;
const PAD_X1: u8 = 13;
/// Right of the pads: > and Func.
const SCENE_X: u8 = 14;
/// The outer edge: the mode arrows, with the settings pad in the corner above.
const EDGE_X: u8 = 15;
const KNOB_Y: u8 = 6;
/// Anchor (upper half-row) of each pad row; the pads span the half-row below too.
const PAD_TOP_Y: u8 = 5;
const PAD_BOTTOM_Y: u8 = 3;
/// ▶ and ● sit beside the lower pad row.
const TRANSPORT_Y: u8 = PAD_BOTTOM_Y;
/// Lower half-row of the bottom pad row: Oct − and Oct +.
const OCT_Y: u8 = 2;
const BLACK_Y: u8 = 1;
const WHITE_Y: u8 = 0;
const PAD_TOP_FIRST: u8 = 96;
const PAD_BOTTOM_FIRST: u8 = 112;
const CC_TRACK_UP: u8 = 106;
const CC_TRACK_DOWN: u8 = 107;
/// The guide's table calls 115 "Loop" and 117 "Play"; the Mini's two transport
/// buttons send these two.
const CC_PLAY: u8 = 115;
const CC_RECORD: u8 = 117;
/// Shift is a feature control: CC 63 on channel 7.
const CC_SHIFT: u8 = 63;
const SHIFT_CHANNEL: u8 = 6;
const CC_KNOB_FIRST: u8 = 21;
const CC_KNOB_LAST: u8 = 28;
/// Lowest and highest key at the default octave (C2..C4).
const KEY_FIRST: u8 = 48;
const KEY_LAST: u8 = 72;
const WHITE_KEYS: u8 = 15;
/// Semitone above C of each white key within an octave.
const WHITE_OFFSETS: [u8; 7] = [0, 2, 4, 5, 7, 9, 11];

pub struct LaunchkeyMiniMk4;

/// Note of white key `i` (0 = the lowest C).
fn white_note(i: u8) -> u8 {
    KEY_FIRST + 12 * (i / 7) + WHITE_OFFSETS[(i % 7) as usize]
}

/// Note of the black key right of white key `i`, if there is one (none after E and B,
/// none after the top C).
fn black_note(i: u8) -> Option<u8> {
    match i % 7 {
        0 | 1 | 3 | 4 | 5 if i + 1 < WHITE_KEYS => Some(white_note(i) + 1),
        _ => None,
    }
}

/// Coordinate of the key playing `note` at the default octave.
fn key_xy(note: u8) -> Option<(u8, u8)> {
    if !(KEY_FIRST..=KEY_LAST).contains(&note) {
        return None;
    }
    let semitone = note - KEY_FIRST;
    let (octave, degree) = (semitone / 12, semitone % 12);
    match WHITE_OFFSETS.iter().position(|o| *o == degree) {
        Some(i) => Some((7 * octave + i as u8, WHITE_Y)),
        // A black key sits at the x of the white key below it.
        None => WHITE_OFFSETS.iter().rposition(|o| *o < degree).map(|i| (7 * octave + i as u8, BLACK_Y)),
    }
}

/// What a control's LED listens to: a note-addressed pad, a colour button
/// addressed by its CC, or a single LED set by a brightness on channel 4.
enum Led {
    Pad(u8),
    ColorButton(u8),
    White(u8),
}

fn led_of(x: u8, y: u8) -> Option<Led> {
    match (x, y) {
        (PAD_X0..=PAD_X1, PAD_TOP_Y) => Some(Led::Pad(PAD_TOP_FIRST + (x - PAD_X0))),
        (PAD_X0..=PAD_X1, PAD_BOTTOM_Y) => Some(Led::Pad(PAD_BOTTOM_FIRST + (x - PAD_X0))),
        (TRACK_X, PAD_TOP_Y) => Some(Led::ColorButton(CC_TRACK_UP)),
        (TRACK_X, PAD_BOTTOM_Y) => Some(Led::ColorButton(CC_TRACK_DOWN)),
        (BLOCK_L_X, TRANSPORT_Y) => Some(Led::White(CC_PLAY)),
        (BLOCK_R_X, TRANSPORT_Y) => Some(Led::White(CC_RECORD)),
        _ => None,
    }
}

/// Brightness 0..127 of a colour for a single white LED.
fn brightness(c: Color) -> u8 {
    ((0.2126 * c.r as f32 + 0.7152 * c.g as f32 + 0.0722 * c.b as f32) / 2.0).round().clamp(0.0, 127.0) as u8
}

impl LaunchpadDriver for LaunchkeyMiniMk4 {
    fn model(&self) -> LaunchpadModel {
        LaunchpadModel::LaunchkeyMiniMk4
    }

    fn layout(&self) -> Layout {
        use PadRegion::*;
        use PadShape::*;
        let mut pads = Vec::with_capacity((WIDTH * HEIGHT) as usize);
        for y in (0..HEIGHT).rev() {
            for x in 0..WIDTH {
                let p = match (x, y) {
                    (0, KNOB_Y) => spec(self, x, y, Strip, Left, Some("Pitch")).with_rows(5).centred(),
                    (1, KNOB_Y) => spec(self, x, y, Strip, Left, Some("Modulation")).with_rows(5),
                    // Covered by the strips.
                    (0 | 1, 2..=PAD_TOP_Y) => continue,
                    // The screen sits above the button block; nothing to press there.
                    (BLOCK_L_X | BLOCK_R_X, KNOB_Y) => spec(self, x, y, Empty, Other, None),
                    (BLOCK_L_X, PAD_TOP_Y) => spec(self, x, y, Rect, Left, Some("Shift")).with_led(LedKind::None),
                    (BLOCK_R_X, PAD_TOP_Y) => spec(self, x, y, Rect, Left, Some("Settings")).with_led(LedKind::None).without_input(),
                    (BLOCK_L_X, TRANSPORT_Y) => spec(self, x, y, Rect, Left, Some("▶")).with_led(LedKind::White),
                    (BLOCK_R_X, TRANSPORT_Y) => spec(self, x, y, Rect, Left, Some("●")).with_led(LedKind::White),
                    (BLOCK_L_X, OCT_Y) => spec(self, x, y, Rect, Left, Some("Oct −")).with_led(LedKind::None).without_input(),
                    (BLOCK_R_X, OCT_Y) => spec(self, x, y, Rect, Left, Some("Oct +")).with_led(LedKind::None).without_input(),
                    (MODE_X, KNOB_Y) => spec(self, x, y, Rect, Left, Some("Arp")).with_led(LedKind::None).without_input(),
                    (MODE_X, PAD_TOP_Y) => spec(self, x, y, Rect, Left, Some("Scale")).with_led(LedKind::None).without_input(),
                    (TRACK_X, PAD_TOP_Y) => spec(self, x, y, Pad, Left, Some("▲")).with_rows(2),
                    (TRACK_X, PAD_BOTTOM_Y) => spec(self, x, y, Pad, Left, Some("▼")).with_rows(2),
                    (PAD_X0..=PAD_X1, KNOB_Y) => spec(self, x, y, Knob, Top, None),
                    (PAD_X0..=PAD_X1, PAD_TOP_Y | PAD_BOTTOM_Y) => spec(self, x, y, Pad, Grid, None).with_rows(2),
                    (SCENE_X, PAD_TOP_Y) => spec(self, x, y, Rect, Right, Some(">")).with_led(LedKind::None).without_input(),
                    (SCENE_X, PAD_BOTTOM_Y) => spec(self, x, y, Rect, Right, Some("Func")).with_led(LedKind::None).without_input(),
                    (EDGE_X, PAD_TOP_Y) => spec(self, x, y, Rect, Right, Some("∧")).with_led(LedKind::None).without_input(),
                    (EDGE_X, PAD_BOTTOM_Y) => spec(self, x, y, Rect, Right, Some("∨")).with_led(LedKind::None).without_input(),
                    // The lower halves of the pad rows, covered by the pads and the track arrows.
                    (TRACK_X | PAD_X0..=PAD_X1, 2 | 4) => continue,
                    // 15 white keys across a 16-column board; the last column stays free.
                    (_, WHITE_Y) if x < WHITE_KEYS => spec(self, x, y, KeyWhite, Bottom, None),
                    (_, BLACK_Y) if black_note(x).is_some() => spec(self, x, y, KeyBlack, Bottom, None),
                    _ => spec(self, x, y, Empty, Other, None),
                };
                pads.push(p);
            }
        }
        Layout {
            model: self.model(),
            model_name: self.model().display_name().into(),
            width: WIDTH,
            height: HEIGHT,
            // Bottom up: white keys, black keys, two half-rows per pad row (a pad spanning
            // both plus the gap between them comes out square), encoders.
            row_weights: vec![1.6, 1.1, 0.46, 0.46, 0.46, 0.46, 0.95],
            pads,
            limited_color: false,
            velocity_sensitive: true,
        }
    }

    fn init_messages(&self) -> Vec<Vec<u8>> {
        vec![
            // DAW mode on.
            vec![0x9F, 0x0C, 0x7F],
            // Pads in the DAW layout, encoders in Plugin mode (absolute CC 21..28).
            vec![0xB6, 0x1D, 0x02],
            vec![0xB6, 0x1E, 0x02],
        ]
    }

    fn unload_messages(&self) -> Vec<Vec<u8>> {
        vec![vec![0x9F, 0x0C, 0x00]]
    }

    fn clear_messages(&self) -> Vec<Vec<u8>> {
        let mut out = Vec::new();
        for note in (PAD_TOP_FIRST..=PAD_TOP_FIRST + 7).chain(PAD_BOTTOM_FIRST..=PAD_BOTTOM_FIRST + 7) {
            out.push(vec![0x90, note, 0]);
        }
        out.push(vec![0xB0, CC_TRACK_UP, 0]);
        out.push(vec![0xB0, CC_TRACK_DOWN, 0]);
        out.push(vec![0xB3, CC_PLAY, 0]);
        out.push(vec![0xB3, CC_RECORD, 0]);
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
                        LedColor::Rgb(c) => brightness(*c),
                        LedColor::Palette(i) | LedColor::Pulsing(i) | LedColor::Flashing { index: i, .. } => brightness(palette_color(*i)),
                    };
                    out.push(vec![0xB3, cc, level]);
                }
                Led::Pad(n) | Led::ColorButton(n) => {
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
            (PAD_X0..=PAD_X1, PAD_TOP_Y) => Some((PAD_TOP_FIRST + (x - PAD_X0), false)),
            (PAD_X0..=PAD_X1, PAD_BOTTOM_Y) => Some((PAD_BOTTOM_FIRST + (x - PAD_X0), false)),
            (PAD_X0..=PAD_X1, KNOB_Y) => Some((CC_KNOB_FIRST + (x - PAD_X0), true)),
            (TRACK_X, PAD_TOP_Y) => Some((CC_TRACK_UP, true)),
            (TRACK_X, PAD_BOTTOM_Y) => Some((CC_TRACK_DOWN, true)),
            (BLOCK_L_X, TRANSPORT_Y) => Some((CC_PLAY, true)),
            (BLOCK_R_X, TRANSPORT_Y) => Some((CC_RECORD, true)),
            (BLOCK_L_X, PAD_TOP_Y) => Some((CC_SHIFT, true)),
            (x, WHITE_Y) if x < WHITE_KEYS => Some((white_note(x), false)),
            (x, BLACK_Y) => black_note(x).map(|n| (n, false)),
            _ => None,
        }
    }

    fn note_to_xy(&self, note: u8, cc: bool) -> Option<(u8, u8)> {
        if cc {
            match note {
                CC_TRACK_UP => Some((TRACK_X, PAD_TOP_Y)),
                CC_TRACK_DOWN => Some((TRACK_X, PAD_BOTTOM_Y)),
                CC_PLAY => Some((BLOCK_L_X, TRANSPORT_Y)),
                CC_RECORD => Some((BLOCK_R_X, TRANSPORT_Y)),
                CC_SHIFT => Some((BLOCK_L_X, PAD_TOP_Y)),
                CC_KNOB_FIRST..=CC_KNOB_LAST => Some((PAD_X0 + (note - CC_KNOB_FIRST), KNOB_Y)),
                _ => None,
            }
        } else {
            match note {
                96..=103 => Some((PAD_X0 + (note - PAD_TOP_FIRST), PAD_TOP_Y)),
                112..=119 => Some((PAD_X0 + (note - PAD_BOTTOM_FIRST), PAD_BOTTOM_Y)),
                KEY_FIRST..=KEY_LAST => key_xy(note),
                _ => None,
            }
        }
    }

    fn press_threshold(&self) -> u8 {
        1
    }

    /// DAW interface: pads are notes on channel 1, the arrow and transport
    /// buttons CCs on channel 1, Shift a CC on channel 7. The encoder CCs are
    /// controls (see `parse_control`); layout reports and everything else are
    /// ignored. The keys never arrive here.
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
            (0xB0, 0, CC_TRACK_UP | CC_TRACK_DOWN | CC_PLAY | CC_RECORD) | (0xB0, SHIFT_CHANNEL, CC_SHIFT) => {
                let (x, y) = self.note_to_xy(number, true)?;
                Some(ButtonEvent { x, y, pressed: value > 0, note: number, cc: true, value })
            }
            _ => None,
        }
    }

    fn parse_control(&self, msg: &[u8]) -> Option<ControlEvent> {
        if msg.len() < 3 || msg[0] != 0xBF || !(CC_KNOB_FIRST..=CC_KNOB_LAST).contains(&msg[1]) {
            return None;
        }
        let (x, y) = self.note_to_xy(msg[1], true)?;
        Some(ControlEvent { x, y, value: msg[2].min(127) as f32 / 127.0 })
    }

    fn has_secondary_input(&self) -> bool {
        true
    }

    /// MIDI interface: the pitch strip as Pitch Bend, the modulation strip as CC 1.
    fn parse_secondary_control(&self, msg: &[u8]) -> Option<ControlEvent> {
        if msg.len() < 3 {
            return None;
        }
        match (msg[0] & 0xF0, msg[1]) {
            (0xE0, lsb) => {
                let bend = ((msg[2].min(127) as u16) << 7) | lsb.min(127) as u16;
                Some(ControlEvent { x: 0, y: KNOB_Y, value: bend as f32 / 16383.0 })
            }
            (0xB0, 1) => Some(ControlEvent { x: 1, y: KNOB_Y, value: msg[2].min(127) as f32 / 127.0 }),
            _ => None,
        }
    }

    /// MIDI interface: the keys, as notes on whichever channel the keyboard is
    /// set to. Notes outside the default octave range and everything else are
    /// ignored.
    fn parse_secondary_input(&self, msg: &[u8], threshold: u8) -> Option<ButtonEvent> {
        if msg.len() < 3 {
            return None;
        }
        let threshold = threshold.max(1);
        let (status, note, value) = (msg[0] & 0xF0, msg[1], msg[2]);
        if !matches!(status, 0x90 | 0x80) {
            return None;
        }
        if status == 0x90 && value > 0 && value < threshold {
            return None;
        }
        let (x, y) = key_xy(note)?;
        Some(ButtonEvent { x, y, pressed: status == 0x90 && value >= threshold, note, cc: false, value })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mk4_mapping() {
        let d = LaunchkeyMiniMk4;
        assert_eq!(d.xy_to_note(PAD_X0, PAD_TOP_Y), Some((96, false)), "top-left pad");
        assert_eq!(d.xy_to_note(PAD_X1, PAD_BOTTOM_Y), Some((119, false)), "bottom-right pad");
        assert_eq!(d.xy_to_note(PAD_X0, 4), None, "the lower half of a pad row is covered by the pad");
        assert_eq!(d.note_to_xy(112, false), Some((PAD_X0, PAD_BOTTOM_Y)));
        assert_eq!(d.xy_to_note(TRACK_X, PAD_TOP_Y), Some((106, true)), "▲ is Track up");
        assert_eq!(d.xy_to_note(TRACK_X, PAD_BOTTOM_Y), Some((107, true)), "▼ is Track down");
        assert_eq!(d.note_to_xy(115, true), Some((BLOCK_L_X, TRANSPORT_Y)), "▶ beside the lower pad row");
        assert_eq!(d.note_to_xy(117, true), Some((BLOCK_R_X, TRANSPORT_Y)), "● beside the lower pad row");
        assert_eq!(d.xy_to_note(BLOCK_L_X, PAD_TOP_Y), Some((63, true)), "Shift");
        assert_eq!(d.xy_to_note(BLOCK_R_X, PAD_TOP_Y), None, "Settings has no DAW message yet");
        assert_eq!(d.xy_to_note(MODE_X, KNOB_Y), None, "Arp is a keyboard function");
        assert_eq!(d.xy_to_note(SCENE_X, PAD_TOP_Y), None, "> has no DAW message yet");
        assert_eq!(d.xy_to_note(EDGE_X, KNOB_Y), None, "the settings corner is free");
    }

    #[test]
    fn mk4_input_as_captured() {
        let d = LaunchkeyMiniMk4;
        // Pads with velocity, release as velocity 0.
        let pad = d.parse_input_with(&[0x90, 0x63, 0x3C], 1).unwrap();
        assert_eq!((pad.x, pad.y, pad.pressed, pad.value), (PAD_X0 + 3, PAD_TOP_Y, true, 60));
        assert!(!d.parse_input_with(&[0x90, 0x63, 0x00], 1).unwrap().pressed);
        // Aftertouch names the pad (the trait's default handles A0 / D0).
        let pressure = d.parse_pressure(&[0xA0, 0x71, 0x28], &[]);
        assert_eq!(pressure.len(), 1);
        assert_eq!((pressure[0].x, pressure[0].y, pressure[0].value), (PAD_X0 + 1, PAD_BOTTOM_Y, 40));
        // Transport and arrows on channel 1, Shift on channel 7.
        let play = d.parse_input_with(&[0xB0, 0x73, 0x7F], 1).unwrap();
        assert_eq!((play.x, play.y, play.pressed), (BLOCK_L_X, TRANSPORT_Y, true));
        assert!(!d.parse_input_with(&[0xB0, 0x75, 0x00], 1).unwrap().pressed);
        assert_eq!(d.parse_input_with(&[0xB0, 0x6A, 0x7F], 1).map(|e| (e.x, e.y)), Some((TRACK_X, PAD_TOP_Y)));
        assert_eq!(d.parse_input_with(&[0xB0, 0x6B, 0x7F], 1).map(|e| (e.x, e.y)), Some((TRACK_X, PAD_BOTTOM_Y)));
        let shift = d.parse_input_with(&[0xB6, 0x3F, 0x7F], 1).unwrap();
        assert_eq!((shift.x, shift.y, shift.pressed), (BLOCK_L_X, PAD_TOP_Y, true));
        assert!(d.parse_input_with(&[0xBF, 0x73, 0x7F], 1).is_none(), "the MK3's channel 16 transport is not the MK4's");
        assert!(d.parse_input_with(&[0xB6, 0x1D, 0x02], 1).is_none(), "layout reports are not presses");
        assert!(d.parse_input_with(&[0x90, 60, 100], 1).is_none(), "keys do not arrive on the DAW interface");
        // Encoders: absolute CC 21..28 on channel 16, never presses.
        let knob = d.parse_control(&[0xBF, 0x1C, 0x0E]).unwrap();
        assert_eq!((knob.x, knob.y), (PAD_X1, KNOB_Y));
        assert!((knob.value - 14.0 / 127.0).abs() < 1e-6);
        assert!(d.parse_input_with(&[0xBF, 0x15, 0x40], 1).is_none());
        assert!(d.parse_control(&[0xB0, 0x15, 0x40]).is_none());
        // Strips and keys on the MIDI interface.
        let pitch = d.parse_secondary_control(&[0xE0, 0x00, 0x40]).unwrap();
        assert!((pitch.value - 0.5).abs() < 0.001, "released pitch strip sits at the centre");
        let modulation = d.parse_secondary_control(&[0xB0, 0x01, 0x7F]).unwrap();
        assert_eq!((modulation.x, modulation.y), (1, 6));
        let key = d.parse_secondary_input(&[0x90, 0x30, 0x06], 1).unwrap();
        assert_eq!((key.x, key.y, key.value), (0, 0, 6));
        assert!(d.parse_secondary_input(&[0xF8], 1).is_none(), "clock is ignored");
    }

    #[test]
    fn mk4_leds_and_layout() {
        let d = LaunchkeyMiniMk4;
        let msgs = d.led_messages(&[
            (PAD_X0, PAD_TOP_Y, LedColor::Palette(5)),
            (TRACK_X, PAD_BOTTOM_Y, LedColor::Flashing { index: 5, alt: 21 }),
            (TRACK_X, PAD_TOP_Y, LedColor::Pulsing(45)),
            (BLOCK_L_X, TRANSPORT_Y, LedColor::Rgb(Color::new(255, 255, 255))),
            (BLOCK_R_X, TRANSPORT_Y, LedColor::Off),
            // Nothing to light: Shift, Arp and the keys.
            (BLOCK_L_X, PAD_TOP_Y, LedColor::Palette(5)),
            (MODE_X, KNOB_Y, LedColor::Palette(5)),
            (0, 0, LedColor::Palette(5)),
        ]);
        assert_eq!(msgs, vec![vec![0x90, 96, 5], vec![0xB0, 107, 5], vec![0xB1, 107, 21], vec![0xB2, 106, 45], vec![0xB3, 115, 127], vec![0xB3, 117, 0]]);
        assert_eq!(d.init_messages()[0], vec![0x9F, 0x0C, 0x7F]);
        assert!(d.clear_messages().contains(&vec![0xB3, 115, 0]));
        let layout = d.layout();
        let at = |x: u8, y: u8| layout.pads.iter().find(|p| p.x == x && p.y == y).unwrap();
        assert_eq!((at(0, 6).shape, at(0, 6).rows, at(0, 6).led), (PadShape::Strip, 5, LedKind::None));
        assert_eq!((at(TRACK_X, PAD_TOP_Y).shape, at(TRACK_X, PAD_TOP_Y).rows, at(TRACK_X, PAD_TOP_Y).label.as_deref()), (PadShape::Pad, 2, Some("▲")));
        assert_eq!(
            (at(BLOCK_L_X, TRANSPORT_Y).shape, at(BLOCK_L_X, TRANSPORT_Y).led, at(BLOCK_L_X, TRANSPORT_Y).label.as_deref()),
            (PadShape::Rect, LedKind::White, Some("▶"))
        );
        assert_eq!(at(BLOCK_L_X, PAD_TOP_Y).label.as_deref(), Some("Shift"));
        assert_eq!(at(BLOCK_R_X, PAD_TOP_Y).label.as_deref(), Some("Settings"));
        assert!(at(BLOCK_R_X, PAD_TOP_Y).note.is_none(), "Settings sends nothing yet");
        assert_eq!(at(EDGE_X, KNOB_Y).shape, PadShape::Empty, "the settings pad needs the top-right corner");
        assert_eq!(layout.pads.iter().filter(|p| p.shape == PadShape::KeyWhite).count(), 15);
        assert_eq!(layout.pads.iter().filter(|p| p.shape == PadShape::KeyBlack).count(), 10);
        assert!(layout.velocity_sensitive);
    }
}
