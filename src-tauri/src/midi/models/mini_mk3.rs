//! Launchpad Mini MK3 driver (programmer mode).
//!
//! Reference: Novation "Launchpad Mini [MK3] Programmer's Reference Manual".
//! Same note map as the Launchpad X; not velocity sensitive.
//! Not yet verified on hardware in this rewrite.

use super::x::{mk3_note_to_xy, rgb_specs};
use super::{spec, sysex, LaunchpadDriver};
use crate::midi::types::*;

const HEADER: [u8; 5] = [0x00, 0x20, 0x29, 0x02, 0x0D];
const MAX_SPECS_PER_MSG: usize = 81;

const TOP_LABELS: [&str; 8] = ["▲", "▼", "◀", "▶", "Session", "Drums", "Keys", "User"];

pub struct MiniMk3;

impl LaunchpadDriver for MiniMk3 {
    fn model(&self) -> LaunchpadModel {
        LaunchpadModel::LaunchpadMiniMk3
    }

    fn layout(&self) -> Layout {
        let mut pads = Vec::with_capacity(81);
        for y in 0..9u8 {
            for x in 0..9u8 {
                let p = match (x, y) {
                    (8, 8) => spec(self, x, y, PadShape::Logo, PadRegion::Other, None),
                    (_, 8) => spec(self, x, y, PadShape::Round, PadRegion::Top, Some(TOP_LABELS[x as usize])),
                    (8, 0) => spec(self, x, y, PadShape::Round, PadRegion::Right, Some("Stop Solo Mute")),
                    (8, _) => spec(self, x, y, PadShape::Round, PadRegion::Right, Some("▶")),
                    _ => spec(self, x, y, PadShape::Pad, PadRegion::Grid, None),
                };
                pads.push(p);
            }
        }
        Layout {
            model: self.model(),
            model_name: self.model().display_name().into(),
            width: 9,
            height: 9,
            row_weights: vec![1.0; 9],
            pads,
            limited_color: false,
        velocity_sensitive: false,
        }
    }

    fn init_messages(&self) -> Vec<Vec<u8>> {
        vec![
            sysex(&HEADER, &[0x0E, 0x01]),
            sysex(&HEADER, &[0x00, 0x7F]),
        ]
    }

    fn unload_messages(&self) -> Vec<Vec<u8>> {
        vec![sysex(&HEADER, &[0x0E, 0x00])]
    }

    fn clear_messages(&self) -> Vec<Vec<u8>> {
        let mut body = vec![0x03];
        for y in 0..9u8 {
            for x in 0..9u8 {
                if let Some((led, _)) = self.xy_to_note(x, y) {
                    body.extend_from_slice(&[0x00, led, 0x00]);
                }
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
        if x > 8 || y > 8 {
            return None;
        }
        let cc = x == 8 || y == 8;
        Some(((y + 1) * 10 + x + 1, cc && !(x == 8 && y == 8)))
    }

    fn note_to_xy(&self, note: u8, _cc: bool) -> Option<(u8, u8)> {
        mk3_note_to_xy(note)
    }
}
