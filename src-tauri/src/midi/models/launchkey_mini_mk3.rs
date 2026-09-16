//! Launchkey Mini MK3 driver (DAW mode over the DAW port, keys over the MIDI
//! port).
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
//! nothing in DAW mode.
//!
//! The 25 keys play on the device's MIDI interface (the second input the
//! manager opens), on the keyboard's own channel: Note 48..72 (C2..C4) at the
//! default octave. An Octave shift moves them out of that range, which the
//! app cannot see, so shifted keys are ignored; with the Arp on a held key
//! repeats. The strips report on the same interface: pitch as Pitch Bend
//! (14 bit, back to the centre when released) and modulation as CC 1; both
//! become control events on any channel.
//!
//! Logical layout (x from the left, y from the bottom), 15 x 7. Each pad row
//! is two half-rows so the side buttons can sit where they are printed: the
//! pads and the scene buttons span both halves.
//!   y = 6  strips (0, 1, spanning down to y = 2)  Shift (2)  knobs (4..11)
//!   y = 5  Transpose (2)  pads (4..11, 2 rows)  ">" (12, 2 rows)
//!   y = 4                                        Arp (13)  Fixed Chord (14)
//!   y = 4  Octave + (2, 2 rows)
//!   y = 3                 pads (4..11, 2 rows)  Stop Solo Mute (12, 2 rows)
//!   y = 2  Octave − (2)                          Play (13)  Record (14)
//!   y = 1  black keys, each at the x of the white key to its left
//!   y = 0  white keys (0..14)
//! Column 3 is the gap between the keyboard buttons and the pads; the empty
//! top-right cell takes the settings pad.

use super::{spec, LaunchpadDriver};
use crate::midi::palette::{nearest_palette_index, palette_color};
use crate::midi::types::*;

const WIDTH: u8 = 15;
const HEIGHT: u8 = 7;
const BUTTON_X: u8 = 2;
const PAD_X0: u8 = 3;
const PAD_X1: u8 = 10;
const SCENE_X: u8 = 11;
const ARP_X: u8 = 12;
const CHORD_X: u8 = 13;
const KNOB_Y: u8 = 6;
/// Anchor (upper half-row) of each pad row; the pads span the half-row below too.
const PAD_TOP_Y: u8 = 5;
const PAD_BOTTOM_Y: u8 = 3;
/// Lower half-row of the bottom pad row: Play and Record.
const TRANSPORT_Y: u8 = 2;
const BLACK_Y: u8 = 1;
const WHITE_Y: u8 = 0;
const CC_SCENE_UP: u8 = 104;
const CC_SCENE_DOWN: u8 = 105;
const CC_SHIFT: u8 = 108;
const CC_PLAY: u8 = 115;
const CC_RECORD: u8 = 117;
const CC_KNOB_FIRST: u8 = 21;
const CC_KNOB_LAST: u8 = 28;
/// Lowest and highest key at the default octave (C2..C4).
const KEY_FIRST: u8 = 48;
const KEY_LAST: u8 = 72;
const WHITE_KEYS: u8 = 15;
/// Semitone above C of each white key within an octave.
const WHITE_OFFSETS: [u8; 7] = [0, 2, 4, 5, 7, 9, 11];

pub struct LaunchkeyMiniMk3;

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

/// Which MIDI channel status a control's LED listens on: note-style pads, CC
/// buttons on channel 1, or the white CC buttons on channel 16.
enum Led {
    Pad(u8),
    SceneButton(u8),
    White(u8),
}

fn led_of(x: u8, y: u8) -> Option<Led> {
    match (x, y) {
        (PAD_X0..=PAD_X1, PAD_TOP_Y) => Some(Led::Pad(96 + (x - PAD_X0))),
        (PAD_X0..=PAD_X1, PAD_BOTTOM_Y) => Some(Led::Pad(112 + (x - PAD_X0))),
        (SCENE_X, PAD_TOP_Y) => Some(Led::SceneButton(CC_SCENE_UP)),
        (SCENE_X, PAD_BOTTOM_Y) => Some(Led::SceneButton(CC_SCENE_DOWN)),
        (ARP_X, TRANSPORT_Y) => Some(Led::White(CC_PLAY)),
        (CHORD_X, TRANSPORT_Y) => Some(Led::White(CC_RECORD)),
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
                    // The side buttons are pad-wide and half a pad tall, black with a printed legend.
                    // Shift sits level with the knobs; Transpose hangs from the top of the upper pad
                    // row; Octave + and − share the lower pad row's height.
                    (BUTTON_X, KNOB_Y) => spec(self, x, y, HalfPad, Left, Some("Shift")).with_led(LedKind::None),
                    (BUTTON_X, PAD_TOP_Y) => spec(self, x, y, HalfPad, Left, Some("Transpose")).with_led(LedKind::None).without_input().at_top(),
                    (BUTTON_X, PAD_BOTTOM_Y) => spec(self, x, y, HalfPad, Left, Some("+")).with_led(LedKind::None).without_input().at_top(),
                    (BUTTON_X, 2) => spec(self, x, y, HalfPad, Left, Some("−")).with_led(LedKind::None).without_input().at_bottom(),
                    (PAD_X0..=PAD_X1, KNOB_Y) => spec(self, x, y, Knob, Top, None),
                    (PAD_X0..=PAD_X1, PAD_TOP_Y | PAD_BOTTOM_Y) => spec(self, x, y, Pad, Grid, None).with_rows(2),
                    // The scene buttons are pad-sized, black, with the legend lit in the LED's colour.
                    (SCENE_X, PAD_TOP_Y) => spec(self, x, y, Pad, Right, Some(">")).with_rows(2).masked(),
                    (SCENE_X, PAD_BOTTOM_Y) => spec(self, x, y, Pad, Right, Some("Stop Solo Mute")).with_rows(2).masked(),
                    // The lower halves of the pad rows, covered by the pads and scene buttons.
                    (PAD_X0..=SCENE_X, 2 | 4) => continue,
                    // Arp, Fixed Chord, Play and Record sit on the bottom line of their pad rows.
                    (ARP_X, 4) => spec(self, x, y, HalfPad, Right, Some("Arp")).with_led(LedKind::None).without_input().at_bottom(),
                    (CHORD_X, 4) => spec(self, x, y, HalfPad, Right, Some("Fixed Chord")).with_led(LedKind::None).without_input().at_bottom(),
                    (ARP_X, TRANSPORT_Y) => spec(self, x, y, HalfPad, Right, Some("▶")).with_led(LedKind::White).at_bottom(),
                    (CHORD_X, TRANSPORT_Y) => spec(self, x, y, HalfPad, Right, Some("●")).with_led(LedKind::White).at_bottom(),
                    (_, WHITE_Y) => spec(self, x, y, KeyWhite, Bottom, None),
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
            // both plus the gap between them comes out square), knobs.
            row_weights: vec![1.6, 1.1, 0.46, 0.46, 0.46, 0.46, 0.95],
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
                        LedColor::Rgb(c) => brightness(*c),
                        LedColor::Palette(i) | LedColor::Pulsing(i) | LedColor::Flashing { index: i, .. } => brightness(palette_color(*i)),
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
            (PAD_X0..=PAD_X1, PAD_TOP_Y) => Some((96 + (x - PAD_X0), false)),
            (PAD_X0..=PAD_X1, PAD_BOTTOM_Y) => Some((112 + (x - PAD_X0), false)),
            (PAD_X0..=PAD_X1, KNOB_Y) => Some((CC_KNOB_FIRST + (x - PAD_X0), true)),
            (SCENE_X, PAD_TOP_Y) => Some((CC_SCENE_UP, true)),
            (SCENE_X, PAD_BOTTOM_Y) => Some((CC_SCENE_DOWN, true)),
            (ARP_X, TRANSPORT_Y) => Some((CC_PLAY, true)),
            (CHORD_X, TRANSPORT_Y) => Some((CC_RECORD, true)),
            (BUTTON_X, KNOB_Y) => Some((CC_SHIFT, true)),
            (x, WHITE_Y) if x < WHITE_KEYS => Some((white_note(x), false)),
            (x, BLACK_Y) => black_note(x).map(|n| (n, false)),
            _ => None,
        }
    }

    fn note_to_xy(&self, note: u8, cc: bool) -> Option<(u8, u8)> {
        if cc {
            match note {
                CC_SCENE_UP => Some((SCENE_X, PAD_TOP_Y)),
                CC_SCENE_DOWN => Some((SCENE_X, PAD_BOTTOM_Y)),
                CC_PLAY => Some((ARP_X, TRANSPORT_Y)),
                CC_RECORD => Some((CHORD_X, TRANSPORT_Y)),
                CC_SHIFT => Some((BUTTON_X, KNOB_Y)),
                CC_KNOB_FIRST..=CC_KNOB_LAST => Some((PAD_X0 + (note - CC_KNOB_FIRST), KNOB_Y)),
                _ => None,
            }
        } else {
            match note {
                96..=103 => Some((PAD_X0 + (note - 96), PAD_TOP_Y)),
                112..=119 => Some((PAD_X0 + (note - 112), PAD_BOTTOM_Y)),
                KEY_FIRST..=KEY_LAST => key_xy(note),
                _ => None,
            }
        }
    }

    fn press_threshold(&self) -> u8 {
        1
    }

    /// DAW interface: pads are notes on channel 1; only the button CCs count as
    /// presses, the knob CCs are controls (see `parse_control`), everything
    /// else is ignored. The keys never arrive here.
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
        if msg.len() < 3 || msg[0] != 0xBF || !(CC_KNOB_FIRST..=CC_KNOB_LAST).contains(&msg[1]) {
            return None;
        }
        let (x, y) = self.note_to_xy(msg[1], true)?;
        Some(ControlEvent { x, y, value: msg[2].min(127) as f32 / 127.0, kind: ControlKind::Knob, released: false })
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
                // Exactly the centre is the strip springing back when let go.
                Some(ControlEvent { x: 0, y: KNOB_Y, value: bend as f32 / 16383.0, kind: ControlKind::SprungStrip, released: bend == 0x2000 })
            }
            (0xB0, 1) => Some(ControlEvent { x: 1, y: KNOB_Y, value: msg[2].min(127) as f32 / 127.0, kind: ControlKind::Strip, released: false }),
            _ => None,
        }
    }

    /// MIDI interface: the keys, as notes on whichever channel the keyboard is
    /// set to. Notes outside the default octave range and everything else
    /// (sustain, the strips handled by `parse_secondary_control`) are ignored.
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
    use crate::midi::types::PadEdge;

    #[test]
    fn launchkey_mapping() {
        let d = LaunchkeyMiniMk3;
        assert_eq!(d.xy_to_note(3, 5), Some((96, false)));
        assert_eq!(d.xy_to_note(10, 3), Some((119, false)));
        assert_eq!(d.xy_to_note(3, 4), None, "the lower half of a pad row is covered by the pad");
        assert_eq!(d.note_to_xy(112, false), Some((3, 3)));
        assert_eq!(d.xy_to_note(11, 5), Some((104, true)));
        assert_eq!(d.note_to_xy(117, true), Some((13, 2)));
        assert_eq!(d.xy_to_note(2, 6), Some((108, true)));
        assert_eq!(d.xy_to_note(2, 5), None, "Transpose has no DAW message");
        assert_eq!(d.xy_to_note(14, 5), None, "the right margin is empty");
        // Presses: pads on channel 1, buttons on their channels, knobs never.
        let pad = d.parse_input_with(&[0x90, 100, 90], 1).unwrap();
        assert_eq!((pad.x, pad.y, pad.pressed, pad.value), (7, 5, true, 90));
        assert!(!d.parse_input_with(&[0x90, 100, 0], 1).unwrap().pressed);
        let play = d.parse_input_with(&[0xBF, 115, 127], 1).unwrap();
        assert_eq!((play.x, play.y, play.pressed), (12, 2, true));
        assert!(d.parse_input_with(&[0xBF, 24, 100], 1).is_none());
        assert!(d.parse_input_with(&[0xB0, 115, 127], 1).is_none(), "Play lives on channel 16");
        assert!(d.parse_input_with(&[0x90, 60, 100], 1).is_none(), "keys do not arrive on the DAW interface");
        let knob = d.parse_control(&[0xBF, 24, 127]).unwrap();
        assert_eq!((knob.x, knob.y), (6, 6));
        assert!((knob.value - 1.0).abs() < 1e-6);
        assert!(d.parse_control(&[0xB0, 24, 127]).is_none());
        // LEDs: pads and scene buttons take palette indices, Play/Record a brightness, the rest nothing.
        let msgs = d.led_messages(&[(3, 5, LedColor::Palette(5)), (11, 3, LedColor::Flashing { index: 5, alt: 21 }), (12, 2, LedColor::Rgb(Color::new(255, 255, 255))), (2, 6, LedColor::Palette(5)), (3, 6, LedColor::Palette(5)), (0, 0, LedColor::Palette(5))]);
        assert_eq!(msgs, vec![vec![0x90, 96, 5], vec![0xB0, 105, 5], vec![0xB1, 105, 21], vec![0xBF, 115, 127]]);
        let layout = d.layout();
        let at = |x: u8, y: u8| layout.pads.iter().find(|p| p.x == x && p.y == y).unwrap();
        assert_eq!((at(0, 6).shape, at(0, 6).rows, at(0, 6).led), (PadShape::Strip, 5, LedKind::None));
        assert!(at(2, 5).note.is_none());
        assert_eq!((at(11, 5).shape, at(11, 5).rows, at(11, 5).label.as_deref()), (PadShape::Pad, 2, Some(">")));
        assert_eq!(at(3, 3).rows, 2, "pads span both half-rows");
        assert!(layout.pads.iter().all(|p| p.y != 4 || matches!(p.x, 2 | 12 | 13 | 14)), "only side buttons and gaps sit on a lower half-row");
        assert_eq!((at(12, 4).shape, at(12, 4).label.as_deref(), at(12, 4).edge), (PadShape::HalfPad, Some("Arp"), PadEdge::Bottom));
        assert_eq!((at(12, 2).shape, at(12, 2).led, at(12, 2).edge), (PadShape::HalfPad, LedKind::White, PadEdge::Bottom));
        assert_eq!(at(13, 6).shape, PadShape::Empty, "the settings pad takes the top-right corner");
        assert!(at(3, 6).label.is_none(), "nothing is printed on the knobs");
    }

    #[test]
    fn launchkey_keys() {
        let d = LaunchkeyMiniMk3;
        // Two octaves C2..C4: 15 white keys, 10 black ones between them.
        assert_eq!(d.xy_to_note(0, 0), Some((48, false)));
        assert_eq!(d.xy_to_note(14, 0), Some((72, false)));
        assert_eq!(d.xy_to_note(0, 1), Some((49, false)), "C#2 sits right of C2");
        assert_eq!(d.xy_to_note(12, 1), Some((70, false)), "A#3 sits right of A3");
        assert_eq!(d.xy_to_note(2, 1), None, "no black key after E");
        assert_eq!(d.xy_to_note(6, 1), None, "no black key after B");
        assert_eq!(d.xy_to_note(14, 1), None, "no black key after the top C");
        assert_eq!(d.note_to_xy(61, false), Some((7, 1)));
        assert_eq!(d.note_to_xy(65, false), Some((10, 0)));
        assert_eq!(d.note_to_xy(73, false), None, "a shifted octave is not seen");
        let layout = d.layout();
        assert_eq!(layout.pads.iter().filter(|p| p.shape == PadShape::KeyWhite).count(), 15);
        assert_eq!(layout.pads.iter().filter(|p| p.shape == PadShape::KeyBlack).count(), 10);
        assert!(layout.pads.iter().filter(|p| matches!(p.shape, PadShape::KeyWhite | PadShape::KeyBlack)).all(|p| p.led == LedKind::None && p.note.is_some()));
        // The keys arrive on the second interface, on any channel, with velocity.
        assert!(d.has_secondary_input());
        let key = d.parse_secondary_input(&[0x90, 60, 100], 1).unwrap();
        assert_eq!((key.x, key.y, key.pressed, key.value, key.cc), (7, 0, true, 100, false));
        assert!(!d.parse_secondary_input(&[0x80, 60, 64], 1).unwrap().pressed);
        assert!(!d.parse_secondary_input(&[0x90, 60, 0], 1).unwrap().pressed);
        assert_eq!(d.parse_secondary_input(&[0x91, 49, 100], 1).map(|e| (e.x, e.y)), Some((0, 1)));
        assert!(d.parse_secondary_input(&[0x90, 60, 10], 20).is_none(), "below the threshold");
        assert!(d.parse_secondary_input(&[0x90, 96, 100], 1).is_none(), "pad notes are not keys");
        assert!(d.parse_secondary_input(&[0xB0, 1, 100], 1).is_none(), "the modulation strip is not a key");
        assert!(d.parse_secondary_input(&[0xE0, 0, 64], 1).is_none(), "the pitch strip is not a key");
        // The strips are controls on the same interface: pitch bend (centre = half way), CC 1.
        let pitch = d.parse_secondary_control(&[0xE0, 0x00, 0x40]).unwrap();
        assert_eq!((pitch.x, pitch.y), (0, 6));
        assert!(pitch.released, "the centre is the strip let go");
        assert!((pitch.value - 0.5).abs() < 0.001);
        assert!((d.parse_secondary_control(&[0xE1, 0x7F, 0x7F]).unwrap().value - 1.0).abs() < 1e-6);
        let modulation = d.parse_secondary_control(&[0xB0, 1, 127]).unwrap();
        assert_eq!((modulation.x, modulation.y, modulation.value), (1, 6, 1.0));
        assert!(d.parse_secondary_control(&[0xB0, 64, 127]).is_none(), "sustain is not a strip");
        assert!(d.parse_secondary_control(&[0x90, 60, 100]).is_none());
        assert!(d.parse_control(&[0xE0, 0, 64]).is_none(), "strips do not report on the DAW interface");
    }
}
