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
//! pads report as CC on channel 1: the Track arrows 106 / 107 with colour LEDs
//! on the same numbers, ▶ 115 and ● 117 with a single LED whose brightness is
//! a CC on channel 4, and the mode arrows right of the encoders 51 / 52. With
//! the feature-control reports switched on (`9F 0B 7F`), Shift, Arp and Scale
//! report on channel 7 (CC 63, 73, 74; Arp and Scale as on / off). The device
//! still acts on its own buttons, so the driver answers: a pad layout other
//! than DAW or an encoder mode other than Plugin (reported as CC 29 / 30 on
//! channel 7, also after the Shift menu) is put back, and Arp or Scale
//! switched on is switched off again, its confirmation counting as the
//! button's release. The eight encoders send CC 21..28 on channel 16 (0..127)
//! and become control events. Settings, Octave, > and Func report nothing.
//! On connect the Lunchpad logo goes to the screen's stationary display
//! (bitmap message `09 20 <1216 bytes>`, generated into `launchkey_screen.rs`)
//! and on unload the display is handed back (`04 20 00`).
//!
//! The keys and the two strips arrive on the MIDI interface exactly as on the
//! Mini MK3: Note 48..72 (C2..C4) at the default octave, Pitch Bend (14 bit,
//! back to the centre when released) and CC 1. That interface also streams
//! MIDI clock, which the manager drops.
//!
//! Logical layout 15 x 8 (x from the left, y from the bottom), one column per
//! white key, following the front panel. The control area is three bands of
//! two half-rows each, so the small buttons can sit where they are printed:
//! the encoder band (y 7 + 6) holds the screen, Arp over Scale, the encoders
//! and the mode arrows; the two pad bands (y 5 + 4, y 3 + 2) hold the pads,
//! the Track arrows, > and Func (tall rounded buttons, a pad row high), and
//! the button block with ▶ and ● between the pad rows and Oct −/+ under them.
//!   x = 0, 1   Pitch and Modulation strips, from the top down to y = 2
//!   x = 2, 3   screen = the settings pad (y 7 + 6, both columns)  Shift  Settings (y 5)  ▶  ● (y 4 + 3)  Oct −  Oct + (y 2)
//!   x = 4      Arp (y 7)  Scale (y 6)  ∧ Track (y 5 + 4)  ∨ Track (y 3 + 2)
//!   x = 5..12  encoders (y 7 + 6)  pads (y 5 + 4 and y 3 + 2)
//!   x = 13     ∧ (y 7)  ∨ (y 6)  > (y 5 + 4)  Func (y 3 + 2)
//!   x = 14     the logo's column, left empty
//!   y = 1      black keys, each at the x of the white key to its left
//!   y = 0      white keys (0..14)
//!
//! Settings, Oct ±, > and Func are drawn but send nothing: two captures on
//! hardware showed no message for them, in DAW mode or with the feature
//! reports on.

use super::{launchkey_screen, spec, LaunchpadDriver};
use crate::midi::palette::{nearest_palette_index, palette_color};
use crate::midi::types::*;

/// SysEx header of the Mini SKUs.
const SYSEX: [u8; 6] = [0xF0, 0x00, 0x20, 0x29, 0x02, 0x13];
/// The screen's stationary display: what it shows when nothing temporary is up.
const SCREEN_STATIONARY: u8 = 0x20;

/// The Lunchpad logo for the stationary display: `09 <target> <1216 bytes>`.
fn logo_message() -> Vec<u8> {
    let mut msg = Vec::with_capacity(SYSEX.len() + 2 + launchkey_screen::LOGO.len() + 1);
    msg.extend_from_slice(&SYSEX);
    msg.push(0x09);
    msg.push(SCREEN_STATIONARY);
    msg.extend_from_slice(&launchkey_screen::LOGO);
    msg.push(0xF7);
    msg
}

/// Configure a display: `04 <target> <config>`; config 0 cancels it.
fn screen_config(target: u8, config: u8) -> Vec<u8> {
    let mut msg = SYSEX.to_vec();
    msg.extend_from_slice(&[0x04, target, config, 0xF7]);
    msg
}

const WIDTH: u8 = 15;
const HEIGHT: u8 = 8;
/// The button block under the screen, two columns: Shift / Settings, ▶ / ●, Oct − / Oct +.
const BLOCK_L_X: u8 = 2;
const BLOCK_R_X: u8 = 3;
/// Arp, Scale and the Track arrows.
const SIDE_X: u8 = 4;
const PAD_X0: u8 = 5;
const PAD_X1: u8 = 12;
/// Right of the pads: the mode arrows, > and Func.
const RIGHT_X: u8 = 13;
/// The logo column: the settings pad in the corner, nothing else.
const LOGO_X: u8 = 14;
/// Upper half-row of the encoder band; the encoders and the screen span both.
const KNOB_Y: u8 = 7;
const KNOB_LOW_Y: u8 = 6;
/// Anchor (upper half-row) of each pad row; the pads span the half-row below too.
const PAD_TOP_Y: u8 = 5;
const PAD_BOTTOM_Y: u8 = 3;
/// ▶ and ● sit between the pad rows: anchored on the lower half of the top
/// row, spanning into the upper half of the bottom row.
const TRANSPORT_Y: u8 = 4;
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
/// The mode arrows right of the encoders: Mode up / down in the guide's table.
const CC_MODE_UP: u8 = 51;
const CC_MODE_DOWN: u8 = 52;
/// Feature controls report on channel 7: Shift, and (once the reports are
/// switched on) Arp and Scale as on / off, plus the pad and encoder layouts.
const FEATURE_CHANNEL: u8 = 6;
const CC_SHIFT: u8 = 63;
const FEATURE_ARP: u8 = 0x49;
const FEATURE_SCALE: u8 = 0x4A;
const FEATURE_PADS: u8 = 0x1D;
const FEATURE_ENCODERS: u8 = 0x1E;
/// The layouts the app wants: pads in the DAW layout, encoders in Plugin mode.
const PADS_DAW: u8 = 0x02;
const ENCODERS_PLUGIN: u8 = 0x02;
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
        (SIDE_X, PAD_TOP_Y) => Some(Led::ColorButton(CC_TRACK_UP)),
        (SIDE_X, PAD_BOTTOM_Y) => Some(Led::ColorButton(CC_TRACK_DOWN)),
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
                    (0, KNOB_Y) => spec(self, x, y, Strip, Left, Some("Pitch")).with_rows(6).centred(),
                    (1, KNOB_Y) => spec(self, x, y, Strip, Left, Some("Modulation")).with_rows(6),
                    // Covered by the strips.
                    (0 | 1, OCT_Y..=KNOB_LOW_Y) => continue,
                    // The screen over the button block: the app's settings pad sits there.
                    (BLOCK_L_X, KNOB_Y) => spec(self, x, y, Logo, Other, None).with_rows(2).with_cols(2),
                    (BLOCK_R_X, KNOB_Y) | (BLOCK_L_X | BLOCK_R_X, KNOB_LOW_Y) => continue,
                    // The block lines up with the pad rows: its top row against the top of the
                    // band, its bottom row against the bottom, ▶ and ● centred between.
                    (BLOCK_L_X, PAD_TOP_Y) => spec(self, x, y, Rect, Left, Some("Shift")).with_led(LedKind::None).at_top(),
                    (BLOCK_R_X, PAD_TOP_Y) => spec(self, x, y, Rect, Left, Some("Settings")).with_led(LedKind::None).without_input().at_top(),
                    (BLOCK_L_X, TRANSPORT_Y) => spec(self, x, y, Rect, Left, Some("▶")).with_led(LedKind::White).with_rows(2).masked(),
                    (BLOCK_R_X, TRANSPORT_Y) => spec(self, x, y, Rect, Left, Some("●")).with_led(LedKind::White).with_rows(2).masked(),
                    // Covered by ▶ and ●.
                    (BLOCK_L_X | BLOCK_R_X, PAD_BOTTOM_Y) => continue,
                    (BLOCK_L_X, OCT_Y) => spec(self, x, y, Rect, Left, Some("Oct −")).with_led(LedKind::None).without_input().at_bottom(),
                    (BLOCK_R_X, OCT_Y) => spec(self, x, y, Rect, Left, Some("Oct +")).with_led(LedKind::None).without_input().at_bottom(),
                    (SIDE_X, KNOB_Y) => spec(self, x, y, SmallRect, Left, Some("Arp")).with_led(LedKind::None).tap(),
                    (SIDE_X, KNOB_LOW_Y) => spec(self, x, y, SmallRect, Left, Some("Scale")).with_led(LedKind::None).tap(),
                    (SIDE_X, PAD_TOP_Y) => spec(self, x, y, TallRect, Left, Some("∧")).with_rows(2),
                    (SIDE_X, PAD_BOTTOM_Y) => spec(self, x, y, TallRect, Left, Some("∨")).with_rows(2),
                    (PAD_X0..=PAD_X1, KNOB_Y) => spec(self, x, y, Knob, Top, None).with_rows(2),
                    (PAD_X0..=PAD_X1, PAD_TOP_Y | PAD_BOTTOM_Y) => spec(self, x, y, Pad, Grid, None).with_rows(2),
                    (RIGHT_X, KNOB_Y) => spec(self, x, y, SmallRect, Right, Some("∧")).with_led(LedKind::None),
                    (RIGHT_X, KNOB_LOW_Y) => spec(self, x, y, SmallRect, Right, Some("∨")).with_led(LedKind::None),
                    (RIGHT_X, PAD_TOP_Y) => spec(self, x, y, TallRect, Right, Some(">")).with_led(LedKind::None).without_input().with_rows(2),
                    (RIGHT_X, PAD_BOTTOM_Y) => spec(self, x, y, TallRect, Right, Some("Func")).with_led(LedKind::None).without_input().with_rows(2),
                    // Lower halves covered by the encoders, the pads and the two-row buttons.
                    (PAD_X0..=PAD_X1, KNOB_LOW_Y) | (SIDE_X..=RIGHT_X, OCT_Y | 4) => continue,
                    // The logo column: the settings pad takes the corner, nothing below it.
                    (LOGO_X, OCT_Y..=KNOB_Y) => spec(self, x, y, Empty, Other, None),
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
            // both plus the gap between them comes out square), two taller ones for the
            // encoder band, which holds two buttons on top of each other.
            row_weights: vec![1.6, 1.1, 0.46, 0.46, 0.46, 0.46, 0.66, 0.66],
            pads,
            limited_color: false,
            velocity_sensitive: true,
        }
    }

    fn init_messages(&self) -> Vec<Vec<u8>> {
        vec![
            // DAW mode on, and every feature control reporting (Arp and Scale presses).
            vec![0x9F, 0x0C, 0x7F],
            vec![0x9F, 0x0B, 0x7F],
            // Pads in the DAW layout, encoders in Plugin mode (absolute CC 21..28).
            vec![0xB6, FEATURE_PADS, PADS_DAW],
            vec![0xB6, FEATURE_ENCODERS, ENCODERS_PLUGIN],
            // The logo on the screen while the app has the device.
            logo_message(),
        ]
    }

    fn unload_messages(&self) -> Vec<Vec<u8>> {
        // The screen back to its own display, then out of DAW mode.
        vec![screen_config(SCREEN_STATIONARY, 0), vec![0x9F, 0x0B, 0x00], vec![0x9F, 0x0C, 0x00]]
    }

    /// The device reports what its own buttons changed; put it back so the
    /// surface stays the app's: the pad and encoder layouts, and Arp or Scale
    /// switched on (their presses still count as buttons).
    fn react(&self, msg: &[u8]) -> Vec<Vec<u8>> {
        if msg.len() < 3 || msg[0] != 0xB0 | FEATURE_CHANNEL {
            return Vec::new();
        }
        match (msg[1], msg[2]) {
            (FEATURE_PADS, layout) if layout != PADS_DAW => vec![vec![0xB6, FEATURE_PADS, PADS_DAW]],
            (FEATURE_ENCODERS, mode) if mode != ENCODERS_PLUGIN => vec![vec![0xB6, FEATURE_ENCODERS, ENCODERS_PLUGIN]],
            (FEATURE_ARP | FEATURE_SCALE, on) if on > 0 => vec![vec![0xB6, msg[1], 0]],
            _ => Vec::new(),
        }
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
            (SIDE_X, PAD_TOP_Y) => Some((CC_TRACK_UP, true)),
            (SIDE_X, PAD_BOTTOM_Y) => Some((CC_TRACK_DOWN, true)),
            (BLOCK_L_X, TRANSPORT_Y) => Some((CC_PLAY, true)),
            (BLOCK_R_X, TRANSPORT_Y) => Some((CC_RECORD, true)),
            (BLOCK_L_X, PAD_TOP_Y) => Some((CC_SHIFT, true)),
            (SIDE_X, KNOB_Y) => Some((FEATURE_ARP, true)),
            (SIDE_X, KNOB_LOW_Y) => Some((FEATURE_SCALE, true)),
            (RIGHT_X, KNOB_Y) => Some((CC_MODE_UP, true)),
            (RIGHT_X, KNOB_LOW_Y) => Some((CC_MODE_DOWN, true)),
            (x, WHITE_Y) if x < WHITE_KEYS => Some((white_note(x), false)),
            (x, BLACK_Y) => black_note(x).map(|n| (n, false)),
            _ => None,
        }
    }

    fn note_to_xy(&self, note: u8, cc: bool) -> Option<(u8, u8)> {
        if cc {
            match note {
                CC_TRACK_UP => Some((SIDE_X, PAD_TOP_Y)),
                CC_TRACK_DOWN => Some((SIDE_X, PAD_BOTTOM_Y)),
                CC_PLAY => Some((BLOCK_L_X, TRANSPORT_Y)),
                CC_RECORD => Some((BLOCK_R_X, TRANSPORT_Y)),
                CC_SHIFT => Some((BLOCK_L_X, PAD_TOP_Y)),
                FEATURE_ARP => Some((SIDE_X, KNOB_Y)),
                FEATURE_SCALE => Some((SIDE_X, KNOB_LOW_Y)),
                CC_MODE_UP => Some((RIGHT_X, KNOB_Y)),
                CC_MODE_DOWN => Some((RIGHT_X, KNOB_LOW_Y)),
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

    /// DAW interface: pads are notes on channel 1; the Track and mode arrows
    /// and the transport are CCs on channel 1; Shift, Arp and Scale report on
    /// channel 7 (Arp and Scale as "on", which `react` turns off again, so the
    /// confirmation is the release). The encoder CCs are controls (see
    /// `parse_control`); layout reports and everything else are ignored. The
    /// keys never arrive here.
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
            (0xB0, 0, CC_TRACK_UP | CC_TRACK_DOWN | CC_PLAY | CC_RECORD | CC_MODE_UP | CC_MODE_DOWN) | (0xB0, FEATURE_CHANNEL, CC_SHIFT | FEATURE_ARP | FEATURE_SCALE) => {
                let (x, y) = self.note_to_xy(number, true)?;
                Some(ButtonEvent { x, y, pressed: value > 0, note: number, cc: true, value })
            }
            _ => None,
        }
    }

    /// Arp and Scale report their toggle once; the device does not confirm the
    /// switch-off the driver answers with, so each press is a tap.
    fn momentary(&self, event: &ButtonEvent) -> bool {
        event.cc && matches!(event.note, FEATURE_ARP | FEATURE_SCALE)
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
        assert_eq!(d.xy_to_note(SIDE_X, PAD_TOP_Y), Some((106, true)), "∧ is Track up");
        assert_eq!(d.xy_to_note(SIDE_X, PAD_BOTTOM_Y), Some((107, true)), "∨ is Track down");
        assert_eq!(d.note_to_xy(115, true), Some((BLOCK_L_X, TRANSPORT_Y)), "▶ between the pad rows");
        assert_eq!(d.note_to_xy(117, true), Some((BLOCK_R_X, TRANSPORT_Y)), "● between the pad rows");
        assert_eq!(d.xy_to_note(BLOCK_L_X, PAD_TOP_Y), Some((63, true)), "Shift");
        assert_eq!(d.xy_to_note(BLOCK_R_X, PAD_TOP_Y), None, "Settings has no DAW message yet");
        assert_eq!(d.xy_to_note(SIDE_X, KNOB_Y), Some((0x49, true)), "Arp reports as a feature control");
        assert_eq!(d.xy_to_note(RIGHT_X, KNOB_LOW_Y), Some((52, true)), "the lower mode arrow is Mode down");
        assert_eq!(d.xy_to_note(RIGHT_X, PAD_TOP_Y), None, "> has no DAW message yet");
        assert_eq!(d.xy_to_note(LOGO_X, KNOB_Y), None, "the logo's corner is free");
        assert_eq!(d.xy_to_note(BLOCK_L_X, KNOB_Y), None, "the screen sends nothing");
        assert_eq!(d.xy_to_note(PAD_X0 + 7, KNOB_Y), Some((28, true)), "the eighth encoder");
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
        assert_eq!(d.parse_input_with(&[0xB0, 0x6A, 0x7F], 1).map(|e| (e.x, e.y)), Some((SIDE_X, PAD_TOP_Y)));
        assert_eq!(d.parse_input_with(&[0xB0, 0x6B, 0x7F], 1).map(|e| (e.x, e.y)), Some((SIDE_X, PAD_BOTTOM_Y)));
        let shift = d.parse_input_with(&[0xB6, 0x3F, 0x7F], 1).unwrap();
        assert_eq!((shift.x, shift.y, shift.pressed), (BLOCK_L_X, PAD_TOP_Y, true));
        assert!(d.parse_input_with(&[0xBF, 0x73, 0x7F], 1).is_none(), "the MK3's channel 16 transport is not the MK4's");
        // Second capture: the mode arrows on channel 1, Arp and Scale as feature reports.
        assert_eq!(d.parse_input_with(&[0xB0, 0x33, 0x7F], 1).map(|e| (e.x, e.y, e.pressed)), Some((RIGHT_X, KNOB_Y, true)));
        assert_eq!(d.parse_input_with(&[0xB0, 0x34, 0x00], 1).map(|e| (e.x, e.y, e.pressed)), Some((RIGHT_X, KNOB_LOW_Y, false)));
        assert_eq!(d.parse_input_with(&[0xB6, 0x49, 0x7F], 1).map(|e| (e.x, e.y, e.pressed)), Some((SIDE_X, KNOB_Y, true)));
        assert_eq!(d.parse_input_with(&[0xB6, 0x4A, 0x00], 1).map(|e| (e.x, e.y, e.pressed)), Some((SIDE_X, KNOB_LOW_Y, false)));
        let arp = d.parse_input_with(&[0xB6, 0x49, 0x7F], 1).unwrap();
        assert!(d.momentary(&arp), "Arp is a tap: the device confirms nothing after the switch-off");
        assert!(!d.momentary(&d.parse_input_with(&[0xB6, 0x3F, 0x7F], 1).unwrap()), "Shift has a real release");
        // The driver puts the device back: Arp on → off, a foreign pad layout → DAW, a foreign encoder mode → Plugin.
        assert_eq!(d.react(&[0xB6, 0x49, 0x7F]), vec![vec![0xB6, 0x49, 0x00]]);
        assert_eq!(d.react(&[0xB6, 0x4A, 0x7F]), vec![vec![0xB6, 0x4A, 0x00]]);
        assert!(d.react(&[0xB6, 0x49, 0x00]).is_empty(), "the off confirmation needs no answer");
        assert_eq!(d.react(&[0xB6, 0x1D, 0x0D]), vec![vec![0xB6, 0x1D, 0x02]]);
        assert!(d.react(&[0xB6, 0x1D, 0x02]).is_empty());
        assert_eq!(d.react(&[0xB6, 0x1E, 0x05]), vec![vec![0xB6, 0x1E, 0x02]]);
        assert!(d.react(&[0xB0, 0x33, 0x7F]).is_empty(), "channel 1 buttons are not feature reports");
        assert!(d.react(&[0x90, 0x60, 0x7F]).is_empty());
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
        assert!(pitch.released, "the centre is the strip let go");
        assert!(!d.parse_secondary_control(&[0xE0, 0x7F, 0x7F]).unwrap().released);
        let modulation = d.parse_secondary_control(&[0xB0, 0x01, 0x7F]).unwrap();
        assert_eq!((modulation.x, modulation.y), (1, KNOB_Y));
        let key = d.parse_secondary_input(&[0x90, 0x30, 0x06], 1).unwrap();
        assert_eq!((key.x, key.y, key.value), (0, 0, 6));
        assert!(d.parse_secondary_input(&[0xF8], 1).is_none(), "clock is ignored");
    }

    #[test]
    fn mk4_leds_and_layout() {
        let d = LaunchkeyMiniMk4;
        let msgs = d.led_messages(&[
            (PAD_X0, PAD_TOP_Y, LedColor::Palette(5)),
            (SIDE_X, PAD_BOTTOM_Y, LedColor::Flashing { index: 5, alt: 21 }),
            (SIDE_X, PAD_TOP_Y, LedColor::Pulsing(45)),
            (BLOCK_L_X, TRANSPORT_Y, LedColor::Rgb(Color::new(255, 255, 255))),
            (BLOCK_R_X, TRANSPORT_Y, LedColor::Off),
            // Nothing to light: Shift, Arp and the keys.
            (BLOCK_L_X, PAD_TOP_Y, LedColor::Palette(5)),
            (SIDE_X, KNOB_Y, LedColor::Palette(5)),
            (0, 0, LedColor::Palette(5)),
        ]);
        assert_eq!(msgs, vec![vec![0x90, 96, 5], vec![0xB0, 107, 5], vec![0xB1, 107, 21], vec![0xB2, 106, 45], vec![0xB3, 115, 127], vec![0xB3, 117, 0]]);
        assert_eq!(d.init_messages()[0], vec![0x9F, 0x0C, 0x7F]);
        assert!(d.init_messages().contains(&vec![0x9F, 0x0B, 0x7F]), "feature reports on, so Arp and Scale presses arrive");
        let logo = d.init_messages().into_iter().find(|m| m.len() > 100).expect("the logo bitmap");
        assert_eq!(&logo[..8], &[0xF0, 0x00, 0x20, 0x29, 0x02, 0x13, 0x09, 0x20]);
        assert_eq!(logo.len(), 8 + 1216 + 1);
        assert_eq!(logo.last(), Some(&0xF7));
        assert!(logo[8..8 + 1216].iter().all(|b| *b < 0x80), "seven bits per data byte");
        assert!(logo[8..8 + 1216].iter().any(|b| *b != 0), "the logo is not blank");
        assert_eq!(d.unload_messages()[0], vec![0xF0, 0x00, 0x20, 0x29, 0x02, 0x13, 0x04, 0x20, 0x00, 0xF7], "the screen is handed back first");
        assert_eq!(d.unload_messages().last(), Some(&vec![0x9F, 0x0C, 0x00]));
        assert!(d.clear_messages().contains(&vec![0xB3, 115, 0]));
        let layout = d.layout();
        assert_eq!((layout.width, layout.height), (15, 8), "one column per white key, three bands of two half-rows");
        let at = |x: u8, y: u8| layout.pads.iter().find(|p| p.x == x && p.y == y).unwrap();
        assert_eq!((at(0, KNOB_Y).shape, at(0, KNOB_Y).rows, at(0, KNOB_Y).led, at(0, KNOB_Y).centred), (PadShape::Strip, 6, LedKind::None, true));
        assert!(!at(1, KNOB_Y).centred, "the modulation strip fills from the bottom");
        assert_eq!((at(PAD_X0, KNOB_Y).shape, at(PAD_X0, KNOB_Y).rows), (PadShape::Knob, 2), "encoders span the band");
        assert_eq!((at(SIDE_X, KNOB_Y).label.as_deref(), at(SIDE_X, KNOB_LOW_Y).label.as_deref()), (Some("Arp"), Some("Scale")));
        assert_eq!((at(SIDE_X, PAD_TOP_Y).shape, at(SIDE_X, PAD_TOP_Y).rows, at(SIDE_X, PAD_TOP_Y).led, at(SIDE_X, PAD_TOP_Y).label.as_deref()), (PadShape::TallRect, 2, LedKind::Rgb, Some("∧")));
        assert_eq!(
            (at(BLOCK_L_X, TRANSPORT_Y).shape, at(BLOCK_L_X, TRANSPORT_Y).rows, at(BLOCK_L_X, TRANSPORT_Y).led, at(BLOCK_L_X, TRANSPORT_Y).label.as_deref()),
            (PadShape::Rect, 2, LedKind::White, Some("▶"))
        );
        assert!(at(BLOCK_L_X, TRANSPORT_Y).mask && at(BLOCK_R_X, TRANSPORT_Y).mask, "▶ and ● light their symbols only");
        assert!(at(SIDE_X, KNOB_Y).momentary && at(SIDE_X, KNOB_LOW_Y).momentary, "Arp and Scale are taps in the layout too");
        assert!(!at(SIDE_X, PAD_TOP_Y).momentary, "the Track arrows have a real release");
        assert!(!at(PAD_X0, PAD_TOP_Y).mask);
        assert_eq!(at(BLOCK_L_X, PAD_TOP_Y).label.as_deref(), Some("Shift"));
        assert_eq!(at(BLOCK_R_X, PAD_TOP_Y).label.as_deref(), Some("Settings"));
        assert!(at(BLOCK_R_X, PAD_TOP_Y).note.is_none(), "Settings sends nothing");
        assert_eq!((at(BLOCK_L_X, PAD_TOP_Y).edge, at(BLOCK_L_X, TRANSPORT_Y).edge, at(BLOCK_L_X, OCT_Y).edge), (PadEdge::Top, PadEdge::Free, PadEdge::Bottom));
        assert_eq!((at(BLOCK_L_X, OCT_Y).label.as_deref(), at(BLOCK_R_X, OCT_Y).label.as_deref()), (Some("Oct −"), Some("Oct +")));
        assert_eq!((at(RIGHT_X, KNOB_Y).label.as_deref(), at(RIGHT_X, KNOB_LOW_Y).label.as_deref()), (Some("∧"), Some("∨")));
        assert_eq!((at(RIGHT_X, PAD_TOP_Y).shape, at(RIGHT_X, PAD_TOP_Y).label.as_deref(), at(RIGHT_X, PAD_TOP_Y).rows), (PadShape::TallRect, Some(">"), 2));
        assert_eq!((at(RIGHT_X, PAD_BOTTOM_Y).label.as_deref(), at(RIGHT_X, PAD_BOTTOM_Y).rows), (Some("Func"), 2));
        assert_eq!((at(BLOCK_L_X, KNOB_Y).shape, at(BLOCK_L_X, KNOB_Y).rows, at(BLOCK_L_X, KNOB_Y).cols), (PadShape::Logo, 2, 2), "the screen hosts the settings pad");
        assert!(layout.pads.iter().all(|p| !(p.x == BLOCK_R_X && p.y == KNOB_Y)), "the screen's other cells are covered");
        assert_eq!(at(LOGO_X, KNOB_Y).shape, PadShape::Empty, "the logo's corner stays empty");
        assert!(layout.pads.iter().all(|p| p.x != LOGO_X || p.y <= BLACK_Y || p.shape == PadShape::Empty), "nothing but keys under the logo");
        assert_eq!(layout.pads.iter().filter(|p| p.shape == PadShape::KeyWhite).count(), 15);
        assert_eq!(layout.pads.iter().filter(|p| p.shape == PadShape::KeyBlack).count(), 10);
        assert!(layout.velocity_sensitive);
    }
}
