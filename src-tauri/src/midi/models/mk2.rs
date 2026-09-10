//! Launchpad MK2 driver.
//!
//! Verified on hardware (macOS, firmware 0.1.7.1). Reference: Novation
//! "Launchpad MK2 Programmer's Reference Manual".
//!
//! Session layout: grid = Note 11..88, right column = Note 19..89 (x9),
//! top row = CC 104..111. RGB values are 0..63.

use super::{spec, sysex, LaunchpadDriver};
use crate::midi::types::*;

const HEADER: [u8; 5] = [0x00, 0x20, 0x29, 0x02, 0x18];
/// Maximum LEDs per RGB SysEx message (manual: 80).
const MAX_RGB_PER_MSG: usize = 80;

const TOP_LABELS: [&str; 8] = ["▲", "▼", "◀", "▶", "Session", "User 1", "User 2", "Mixer"];

pub struct Mk2;

impl LaunchpadDriver for Mk2 {
    fn model(&self) -> LaunchpadModel {
        LaunchpadModel::LaunchpadMk2
    }

    fn layout(&self) -> Layout {
        let mut pads = Vec::with_capacity(81);
        for y in 0..9u8 {
            for x in 0..9u8 {
                let p = match (x, y) {
                    (8, 8) => spec(self, x, y, PadShape::Empty, PadRegion::Other, None),
                    (_, 8) => spec(self, x, y, PadShape::Round, PadRegion::Top, Some(TOP_LABELS[x as usize])),
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
            // Select Session layout (0 = Session)
            sysex(&HEADER, &[0x22, 0x00]),
            // All LEDs off
            sysex(&HEADER, &[0x0E, 0x00]),
        ]
    }

    fn unload_messages(&self) -> Vec<Vec<u8>> {
        vec![sysex(&HEADER, &[0x0E, 0x00])]
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
        super::mk2_style_led_messages(&HEADER, MAX_RGB_PER_MSG, true, leds, |x, y| self.xy_to_note(x, y))
    }

    fn xy_to_note(&self, x: u8, y: u8) -> Option<(u8, bool)> {
        match (x, y) {
            (0..=7, 8) => Some((104 + x, true)),
            (0..=8, 0..=7) => Some(((y + 1) * 10 + x + 1, false)),
            _ => None,
        }
    }

    fn note_to_xy(&self, note: u8, cc: bool) -> Option<(u8, u8)> {
        if cc {
            return match note {
                104..=111 => Some((note - 104, 8)),
                _ => None,
            };
        }
        if !(11..=89).contains(&note) || note % 10 == 0 {
            return None;
        }
        Some((note % 10 - 1, note / 10 - 1))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mk2_mapping_matches_manual() {
        let d = Mk2;
        assert_eq!(d.xy_to_note(0, 0), Some((11, false))); // bottom-left pad
        assert_eq!(d.xy_to_note(7, 7), Some((88, false))); // top-right pad
        assert_eq!(d.xy_to_note(8, 0), Some((19, false))); // bottom scene button
        assert_eq!(d.xy_to_note(8, 7), Some((89, false))); // top scene button
        assert_eq!(d.xy_to_note(0, 8), Some((104, true))); // top-left arrow
        assert_eq!(d.xy_to_note(8, 8), None);
        assert_eq!(d.note_to_xy(104, true), Some((0, 8)));
        assert_eq!(d.note_to_xy(104, false), None);
        assert_eq!(d.note_to_xy(90, false), None);
    }

    #[test]
    fn mk2_rgb_message() {
        let msgs = Mk2.color_messages(&[(0, 0, Color::new(255, 0, 128))]);
        assert_eq!(msgs, vec![vec![0xF0, 0x00, 0x20, 0x29, 0x02, 0x18, 0x0B, 11, 63, 0, 32, 0xF7]]);
    }
}
