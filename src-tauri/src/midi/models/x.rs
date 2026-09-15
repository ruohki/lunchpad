//! Launchpad X driver (programmer mode).
//!
//! Reference: Novation "Launchpad X Programmer's Reference Manual".
//! Verified on hardware (firmware 0.2.3.8, 2026-09-10): identification,
//! MIDI/DAW pair selection, grid / top row / right column mapping, solid,
//! flashing, pulsing and RGB colours, velocity, aftertouch, hot-plug.
//! The real inquiry reply carries family bytes `03 01`, not the manual's `13 01`.
//!
//! Programmer mode: grid = Note 11..88, right column = CC 19..89, top row =
//! CC 91..98, logo LED = 99. LED colour SysEx accepts 0..127 per channel.

use super::{spec, sysex, LaunchpadDriver};
use crate::midi::types::*;

const HEADER: [u8; 5] = [0x00, 0x20, 0x29, 0x02, 0x0C];
const MAX_SPECS_PER_MSG: usize = 81;

const TOP_LABELS: [&str; 8] = ["▲", "▼", "◀", "▶", "Session", "Note", "Custom", "● Capture"];
/// Right column, listed from top (y = 7) to bottom (y = 0).
const RIGHT_LABELS: [&str; 8] = ["Volume", "Pan", "Send A", "Send B", "Stop Clip", "Mute", "Solo", "Rec Arm"];

pub struct LaunchpadX;

impl LaunchpadDriver for LaunchpadX {
    fn model(&self) -> LaunchpadModel {
        LaunchpadModel::LaunchpadX
    }

    fn layout(&self) -> Layout {
        let mut pads = Vec::with_capacity(81);
        for y in 0..9u8 {
            for x in 0..9u8 {
                let p = match (x, y) {
                    (8, 8) => spec(self, x, y, PadShape::Logo, PadRegion::Other, None),
                    (_, 8) => spec(self, x, y, PadShape::Square, PadRegion::Top, Some(TOP_LABELS[x as usize])),
                    (8, _) => spec(self, x, y, PadShape::Square, PadRegion::Right, Some(RIGHT_LABELS[7 - y as usize])),
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
        velocity_sensitive: true,
        }
    }

    fn init_messages(&self) -> Vec<Vec<u8>> {
        vec![
            // Programmer mode on
            sysex(&HEADER, &[0x0E, 0x01]),
            // Select programmer layout
            sysex(&HEADER, &[0x00, 0x7F]),
        ]
    }

    fn unload_messages(&self) -> Vec<Vec<u8>> {
        // Back to Live mode; the device restores its own state.
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

    fn press_threshold(&self) -> u8 {
        25
    }
}

/// Shared by X / Mini MK3: Note 11..99 → (x, y); ignores whether it came as CC.
pub(super) fn mk3_note_to_xy(note: u8) -> Option<(u8, u8)> {
    if !(11..=99).contains(&note) || note % 10 == 0 {
        return None;
    }
    let (x, y) = (note % 10 - 1, note / 10 - 1);
    if x == 8 && y == 8 {
        return None; // logo LED, not a button
    }
    Some((x, y))
}

/// Shared "LED lighting" SysEx builder for X / Mini MK3 / Pro MK3:
/// `03` followed by `03 <led> <r> <g> <b>` specs (0..127 per channel).
pub(super) fn rgb_specs(
    header: &[u8],
    max_per_msg: usize,
    pads: &[(u8, u8, Color)],
    map: impl Fn(u8, u8) -> Option<(u8, bool)>,
) -> Vec<Vec<u8>> {
    let mut entries: Vec<[u8; 5]> = Vec::with_capacity(pads.len());
    for (x, y, c) in pads {
        if let Some((led, _)) = map(*x, *y) {
            entries.push([0x03, led, c.r / 2, c.g / 2, c.b / 2]);
        }
    }
    entries
        .chunks(max_per_msg)
        .map(|chunk| {
            let mut body = vec![0x03];
            for e in chunk {
                body.extend_from_slice(e);
            }
            sysex(header, &body)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn x_mapping() {
        let d = LaunchpadX;
        assert_eq!(d.xy_to_note(0, 0), Some((11, false)));
        assert_eq!(d.xy_to_note(8, 0), Some((19, true)));
        assert_eq!(d.xy_to_note(0, 8), Some((91, true)));
        assert_eq!(d.xy_to_note(8, 8), Some((99, false)));
        assert_eq!(d.note_to_xy(99, false), None);
        assert_eq!(d.note_to_xy(91, true), Some((0, 8)));
    }
}
