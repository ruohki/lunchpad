//! Launchpad Pro (MK2) driver.
//!
//! Reference: Novation "Launchpad Pro Programmer's Reference Guide".
//! Hardware-verified 2026-09-10 on firmware 0.1.8.2: identification, the
//! Standalone port pair, presses on all four sides, flash/pulse, velocity,
//! faders and hot-plug. The device answers the inquiry on its Live and
//! Standalone ports; the scanner keeps the Standalone pair (`scan::rank_for`).
//!
//! Velocity is a setting on the device, remembered per layout: on the Pro's
//! set-up screen (hold Setup) the third grid row from the top has Low / Med /
//! High / Off. With Off every press arrives as 127 in Programmer layout too.
//!
//! Programmer layout: grid = Note 11..88; all edge buttons are CC:
//! top 91..98, bottom 1..8, left 10..80 (x10), right 19..89 (x9).
//! RGB values are 0..63.
//!
//! Layout is the device's own 10 x 10 numbering (y = 0 bottom): grid x, y = 1..8,
//! bottom row y = 0, top row y = 9, left column x = 0, right column x = 9.

use super::{spec, sysex, LaunchpadDriver};
use crate::midi::types::*;

const HEADER: [u8; 5] = [0x00, 0x20, 0x29, 0x02, 0x10];
const MAX_RGB_PER_MSG: usize = 78;

const TOP_LABELS: [&str; 8] = ["▲", "▼", "◀", "▶", "Session", "Note", "Device", "User"];
const BOTTOM_LABELS: [&str; 8] = ["Rec Arm", "Track Sel", "Mute", "Solo", "Volume", "Pan", "Sends", "Stop Clip"];
/// Left column from top (y = 8) to bottom (y = 1).
const LEFT_LABELS: [&str; 8] = ["Shift", "Click", "Undo", "Delete", "Quantise", "Duplicate", "Double", "●"];

pub struct ProMk2;

impl LaunchpadDriver for ProMk2 {
    fn model(&self) -> LaunchpadModel {
        LaunchpadModel::LaunchpadProMk2
    }

    fn layout(&self) -> Layout {
        let mut pads = Vec::with_capacity(100);
        for y in 0..10u8 {
            for x in 0..10u8 {
                let p = match (x, y) {
                    (0, 0) | (9, 0) | (0, 9) | (9, 9) => spec(self, x, y, PadShape::Empty, PadRegion::Other, None),
                    (_, 9) => spec(self, x, y, PadShape::Round, PadRegion::Top, Some(TOP_LABELS[x as usize - 1])),
                    (_, 0) => spec(self, x, y, PadShape::Round, PadRegion::Bottom, Some(BOTTOM_LABELS[x as usize - 1])),
                    (0, _) => spec(self, x, y, PadShape::Round, PadRegion::Left, Some(LEFT_LABELS[8 - y as usize])),
                    (9, _) => spec(self, x, y, PadShape::Round, PadRegion::Right, Some("▶")),
                    _ => spec(self, x, y, PadShape::Pad, PadRegion::Grid, None),
                };
                pads.push(p);
            }
        }
        Layout {
            model: self.model(),
            model_name: self.model().display_name().into(),
            width: 10,
            height: 10,
            row_weights: vec![1.0; 10],
            pads,
            limited_color: false,
            velocity_sensitive: true,
        }
    }

    fn init_messages(&self) -> Vec<Vec<u8>> {
        vec![
            // Standalone mode
            sysex(&HEADER, &[0x21, 0x01]),
            // Programmer layout
            sysex(&HEADER, &[0x2C, 0x03]),
            // All LEDs off
            sysex(&HEADER, &[0x0E, 0x00]),
        ]
    }

    fn unload_messages(&self) -> Vec<Vec<u8>> {
        vec![
            sysex(&HEADER, &[0x0E, 0x00]),
            // Back to Note layout so the device is usable standalone
            sysex(&HEADER, &[0x2C, 0x00]),
        ]
    }

    fn clear_messages(&self) -> Vec<Vec<u8>> {
        vec![sysex(&HEADER, &[0x0E, 0x00])]
    }

    fn color_messages(&self, pads: &[(u8, u8, Color)]) -> Vec<Vec<u8>> {
        let mut entries: Vec<[u8; 4]> = Vec::with_capacity(pads.len());
        for (x, y, c) in pads {
            if let Some((led, _)) = self.xy_to_note(*x, *y) {
                entries.push([led, c.r / 4, c.g / 4, c.b / 4]);
            }
        }
        entries
            .chunks(MAX_RGB_PER_MSG)
            .map(|chunk| {
                let mut body = vec![0x0B];
                for e in chunk {
                    body.extend_from_slice(e);
                }
                sysex(&HEADER, &body)
            })
            .collect()
    }

    fn led_messages(&self, leds: &[(u8, u8, LedColor)]) -> Vec<Vec<u8>> {
        super::mk2_style_led_messages(&HEADER, MAX_RGB_PER_MSG, false, leds, |x, y| self.xy_to_note(x, y))
    }

    fn xy_to_note(&self, x: u8, y: u8) -> Option<(u8, bool)> {
        if x > 9 || y > 9 || matches!((x, y), (0, 0) | (9, 0) | (0, 9) | (9, 9)) {
            return None;
        }
        let edge = x == 0 || x == 9 || y == 0 || y == 9;
        Some((y * 10 + x, edge))
    }

    fn note_to_xy(&self, note: u8, _cc: bool) -> Option<(u8, u8)> {
        if note > 99 {
            return None;
        }
        let (x, y) = (note % 10, note / 10);
        if matches!((x, y), (0, 0) | (9, 0) | (0, 9) | (9, 9)) {
            return None;
        }
        Some((x, y))
    }

    fn press_threshold(&self) -> u8 {
        25
    }
}
