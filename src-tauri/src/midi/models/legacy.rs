//! Driver for the first-generation Launchpads: Launchpad (MK1), Launchpad S,
//! Launchpad Mini (MK1 and MK2).
//!
//! Reference: Novation "Launchpad S Programmer's Reference". These devices
//! have red/green LEDs only and no SysEx colour commands: colours are Note On
//! velocities encoded as `0x10 * green + red + 0x0C` with red/green in 0..3.
//!
//! Hardware-verified 2026-09-10 on a Launchpad S and a Launchpad Mini: the S
//! does not answer the device inquiry and is identified by its port name, the
//! Mini (firmware 0.0.3.2, port "Launchpad Mini") answers it; presses on all
//! sides, LED colours, double-buffer flashing and hot-plug confirmed on both.
//! The original Launchpad (MK1) shares the protocol and is not yet checked.
//!
//! Note map (X-Y layout): grid row `r` from the top is Note `r * 16 + x`, so
//! with y counted from the bottom: note = (7 - y) * 16 + x. Right column =
//! same row + 8. Top row = CC 104..111.
//!
//! Flashing uses the hardware's double buffering: `B0 00 28` keeps the device
//! alternating between its two LED buffers. Steady LEDs are written to both
//! buffers (copy + clear flags, `0x0C`); a flashing pad gets colour A in
//! buffer 0 and colour B in buffer 1 (`B0 00 2C` selects buffer 1 for
//! writing, `B0 00 28` returns to buffer 0). Pulsing is not available and
//! shows as a steady colour.

use super::{spec, LaunchpadDriver};
use crate::midi::palette::palette_color;
use crate::midi::types::*;

const TOP_LABELS: [&str; 8] = ["▲", "▼", "◀", "▶", "Session", "User 1", "User 2", "Mixer"];
/// Right column from top (y = 7) to bottom (y = 0).
const RIGHT_LABELS: [&str; 8] = ["Vol", "Pan", "Snd A", "Snd B", "Stop", "Trk On", "Solo", "Arm"];

pub struct Legacy;

/// Write to both buffers (copy) and clear the other buffer's copy: a steady LED.
const STEADY: u8 = 0x0C;
/// Flash on, display buffer 0, write to buffer 0.
const FLASH_WRITE_0: [u8; 3] = [0xB0, 0x00, 0x28];
/// Flash on, display buffer 0, write to buffer 1.
const FLASH_WRITE_1: [u8; 3] = [0xB0, 0x00, 0x2C];
const RESET: [u8; 3] = [0xB0, 0x00, 0x00];

/// Red / green levels (0..3) the LEDs can show for a colour; blue is dropped.
fn levels(c: Color) -> (u8, u8) {
    let r = ((c.r as u16 + 42) / 85).min(3) as u8;
    let g = ((c.g as u16 + 42) / 85).min(3) as u8;
    (r, g)
}

fn velocity_with(c: Color, flags: u8) -> u8 {
    let (r, g) = levels(c);
    0x10 * g + r + flags
}

fn velocity(c: Color) -> u8 {
    velocity_with(c, STEADY)
}

impl LaunchpadDriver for Legacy {
    fn model(&self) -> LaunchpadModel {
        LaunchpadModel::LaunchpadLegacy
    }

    fn layout(&self) -> Layout {
        let mut pads = Vec::with_capacity(81);
        for y in 0..9u8 {
            for x in 0..9u8 {
                let p = match (x, y) {
                    (8, 8) => spec(self, x, y, PadShape::Empty, PadRegion::Other, None),
                    (_, 8) => spec(self, x, y, PadShape::Round, PadRegion::Top, Some(TOP_LABELS[x as usize])),
                    (8, _) => spec(self, x, y, PadShape::Round, PadRegion::Right, Some(RIGHT_LABELS[7 - y as usize])),
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
            limited_color: true,
        velocity_sensitive: false,
        }
    }

    fn init_messages(&self) -> Vec<Vec<u8>> {
        // Reset (all LEDs off, X-Y layout, buffers cleared), then keep the
        // buffers alternating so flashing pads work.
        vec![RESET.to_vec(), FLASH_WRITE_0.to_vec()]
    }

    fn unload_messages(&self) -> Vec<Vec<u8>> {
        vec![RESET.to_vec()]
    }

    fn clear_messages(&self) -> Vec<Vec<u8>> {
        // The reset also turns automatic flashing off; switch it back on.
        vec![RESET.to_vec(), FLASH_WRITE_0.to_vec()]
    }

    fn led_messages(&self, leds: &[(u8, u8, LedColor)]) -> Vec<Vec<u8>> {
        let mut out = Vec::with_capacity(leds.len() + 2);
        let mut alt = Vec::new();
        for (x, y, led) in leds {
            let Some((note, cc)) = self.xy_to_note(*x, *y) else { continue };
            let status = if cc { 0xB0 } else { 0x90 };
            match led {
                LedColor::Flashing { index, alt: alt_index } => {
                    let a = palette_color(*index);
                    let b = palette_color(*alt_index);
                    // Colour A into buffer 0 only; B follows into buffer 1.
                    out.push(vec![status, note, velocity_with(a, 0x00)]);
                    alt.push(vec![status, note, velocity_with(b, 0x00)]);
                }
                other => out.push(vec![status, note, velocity(other.rgb())]),
            }
        }
        if !alt.is_empty() {
            out.push(FLASH_WRITE_1.to_vec());
            out.extend(alt);
            out.push(FLASH_WRITE_0.to_vec());
        }
        out
    }

    fn color_messages(&self, pads: &[(u8, u8, Color)]) -> Vec<Vec<u8>> {
        pads.iter()
            .filter_map(|(x, y, c)| {
                let (note, cc) = self.xy_to_note(*x, *y)?;
                let status = if cc { 0xB0 } else { 0x90 };
                Some(vec![status, note, velocity(*c)])
            })
            .collect()
    }

    fn xy_to_note(&self, x: u8, y: u8) -> Option<(u8, bool)> {
        match (x, y) {
            (0..=7, 8) => Some((104 + x, true)),
            (0..=8, 0..=7) => Some(((7 - y) * 16 + x, false)),
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
        let (x, row) = (note % 16, note / 16);
        if x > 8 || row > 7 {
            return None;
        }
        Some((x, 7 - row))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn legacy_mapping() {
        let d = Legacy;
        assert_eq!(d.xy_to_note(0, 7), Some((0, false))); // top-left pad
        assert_eq!(d.xy_to_note(0, 0), Some((112, false))); // bottom-left pad
        assert_eq!(d.xy_to_note(8, 7), Some((8, false))); // top scene button
        assert_eq!(d.xy_to_note(0, 8), Some((104, true)));
        assert_eq!(velocity(Color::new(255, 255, 0)), 0x10 * 3 + 3 + 0x0C);
        assert_eq!(velocity(Color::OFF), 0x0C);
        assert_eq!(velocity(Color::new(0, 0, 255)), 0x0C, "blue has no LED");
    }

    #[test]
    fn flashing_uses_both_buffers() {
        let d = Legacy;
        let red = palette_color(5);
        let green = palette_color(21);
        let msgs = d.led_messages(&[(0, 7, LedColor::Palette(5)), (1, 7, LedColor::Flashing { index: 5, alt: 21 }), (2, 7, LedColor::Pulsing(21))]);
        assert_eq!(msgs[0], vec![0x90, 0, velocity(red)]);
        assert_eq!(msgs[1], vec![0x90, 1, velocity_with(red, 0)]);
        assert_eq!(msgs[2], vec![0x90, 2, velocity(green)], "pulsing shows steady");
        assert_eq!(msgs[3], FLASH_WRITE_1.to_vec());
        assert_eq!(msgs[4], vec![0x90, 1, velocity_with(green, 0)]);
        assert_eq!(msgs[5], FLASH_WRITE_0.to_vec());
        assert_eq!(msgs.len(), 6);
        assert_eq!(d.init_messages(), vec![RESET.to_vec(), FLASH_WRITE_0.to_vec()]);
    }
}
