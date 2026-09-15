//! Launchpad Pro MK3 driver (programmer mode).
//!
//! Reference: Novation "Launchpad Pro [MK3] Programmer's Reference Manual".
//! Not yet verified on hardware in this rewrite; mirrors the legacy app.
//!
//! The ring of function buttons around the grid is `Square`: pad-sized black
//! buttons with barely rounded corners whose printed symbol lights up (the
//! smaller Shift keeps `Small`).
//!
//! Layout is 10 columns x 11 rows (y = 0 bottom):
//!   y = 0   bottom function row      CC 1..8
//!   y = 1   track select row         CC 101..108
//!   y = 2..9 grid Note 11..88, left CC 10..80 (x10), right CC 19..89 (x9)
//!   y = 10  top row CC 91..98, shift button 90 (small), logo LED 99
//! LED colour SysEx accepts 0..127 per channel.

use super::x::rgb_specs;
use super::{spec, sysex, LaunchpadDriver};
use crate::midi::types::*;

const HEADER: [u8; 5] = [0x00, 0x20, 0x29, 0x02, 0x0E];
const MAX_SPECS_PER_MSG: usize = 81;

const TOP_LABELS: [&str; 8] = ["◀", "▶", "Session", "Note", "Chord", "Custom", "Sequencer", "Projects"];
const BOTTOM_LABELS: [&str; 8] = ["Rec Arm", "Mute", "Solo", "Volume", "Pan", "Sends", "Device", "Stop Clip"];
/// Left column from top (y = 9) to bottom (y = 2).
const LEFT_LABELS: [&str; 8] = ["▲", "▼", "Clear", "Duplicate", "Quantise", "Fixed Len", "▶", "● Capture"];
/// Right column from top (y = 9) to bottom (y = 2).
const RIGHT_LABELS: [&str; 8] = ["Patterns", "Steps", "Pattern Set.", "Velocity", "Probability", "Mutation", "Micro-step", "Print to Clip"];

pub struct ProMk3;

impl LaunchpadDriver for ProMk3 {
    fn model(&self) -> LaunchpadModel {
        LaunchpadModel::LaunchpadProMk3
    }

    fn layout(&self) -> Layout {
        let mut pads = Vec::with_capacity(110);
        for y in 0..11u8 {
            for x in 0..10u8 {
                let p = match (x, y) {
                    (0, 0) | (9, 0) | (0, 1) | (9, 1) => spec(self, x, y, PadShape::Empty, PadRegion::Other, None),
                    (_, 0) => spec(self, x, y, PadShape::Square, PadRegion::Bottom, Some(BOTTOM_LABELS[x as usize - 1])),
                    (_, 1) => spec(self, x, y, PadShape::Square, PadRegion::Bottom2, Some("—")),
                    (0, 10) => spec(self, x, y, PadShape::Small, PadRegion::Top, Some("Shift")),
                    (9, 10) => spec(self, x, y, PadShape::Logo, PadRegion::Other, None),
                    (_, 10) => spec(self, x, y, PadShape::Square, PadRegion::Top, Some(TOP_LABELS[x as usize - 1])),
                    (0, _) => spec(self, x, y, PadShape::Square, PadRegion::Left, Some(LEFT_LABELS[9 - y as usize])),
                    (9, _) => spec(self, x, y, PadShape::Square, PadRegion::Right, Some(RIGHT_LABELS[9 - y as usize])),
                    _ => spec(self, x, y, PadShape::Pad, PadRegion::Grid, None),
                };
                pads.push(p);
            }
        }
        let mut row_weights = vec![1.0; 11];
        row_weights[0] = 0.55;
        row_weights[1] = 0.55;
        Layout {
            model: self.model(),
            model_name: self.model().display_name().into(),
            width: 10,
            height: 11,
            row_weights,
            pads,
            limited_color: false,
            velocity_sensitive: true,
        }
    }

    fn init_messages(&self) -> Vec<Vec<u8>> {
        // Two steps, in this order (manual, "Mode Hierarchy Table"): Programmer
        // mode sits beside Live and DAW mode, so a device a DAW left in Session
        // ignores the Programmer toggle. `10h 00` puts it back to Standalone
        // first, `0Eh 01` then switches to Programmer.
        vec![sysex(&HEADER, &[0x10, 0x00]), sysex(&HEADER, &[0x0E, 0x01])]
    }

    fn unload_messages(&self) -> Vec<Vec<u8>> {
        vec![sysex(&HEADER, &[0x0E, 0x00])]
    }

    fn clear_messages(&self) -> Vec<Vec<u8>> {
        let mut body = vec![0x03];
        for pad in self.layout().pads {
            if let Some(led) = pad.note {
                body.extend_from_slice(&[0x00, led, 0x00]);
            }
        }
        vec![sysex(&HEADER, &body)]
    }

    fn color_messages(&self, pads: &[(u8, u8, Color)]) -> Vec<Vec<u8>> {
        rgb_specs(&HEADER, MAX_SPECS_PER_MSG, pads, |x, y| self.xy_to_note(x, y))
    }

    fn led_messages(&self, leds: &[(u8, u8, LedColor)]) -> Vec<Vec<u8>> {
        super::mk3_style_led_messages(&HEADER, MAX_SPECS_PER_MSG, leds, |x, y| self.xy_to_note(x, y))
    }

    fn xy_to_note(&self, x: u8, y: u8) -> Option<(u8, bool)> {
        if x > 9 || y > 10 {
            return None;
        }
        match y {
            0 | 1 => {
                if x == 0 || x == 9 {
                    return None;
                }
                Some((if y == 0 { x } else { 100 + x }, true))
            }
            10 => match x {
                0 => Some((90, true)),
                9 => Some((99, false)),
                _ => Some((90 + x, true)),
            },
            _ => {
                let edge = x == 0 || x == 9;
                Some(((y - 1) * 10 + x, edge))
            }
        }
    }

    fn note_to_xy(&self, note: u8, _cc: bool) -> Option<(u8, u8)> {
        match note {
            1..=8 => Some((note, 0)),
            101..=108 => Some((note - 100, 1)),
            90 => Some((0, 10)),
            91..=98 => Some((note - 90, 10)),
            99 => Some((9, 10)),
            10..=89 => Some((note % 10, note / 10 + 1)),
            _ => None,
        }
    }

    fn press_threshold(&self) -> u8 {
        25
    }
}
