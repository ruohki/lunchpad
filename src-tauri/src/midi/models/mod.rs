//! Per-model Launchpad drivers.
//!
//! Each driver knows how to (a) put the device into a mode where every button
//! reports presses and every LED is addressable, (b) translate layout
//! coordinates to MIDI notes/CCs and back, and (c) build LED colour messages.
//! Drivers are pure: they only build byte vectors and never touch a port.

mod launchkey_mini_mk3;
mod launchkey_mini_mk4;
mod launchkey_screen;
mod legacy;
mod mini_mk3;
mod mk2;
mod pro_mk2;
mod pro_mk3;
mod x;

use super::types::*;

pub trait LaunchpadDriver: Send + Sync {
    fn model(&self) -> LaunchpadModel;

    /// Static description of the button matrix for the UI.
    fn layout(&self) -> Layout;

    /// Messages to send right after opening the device.
    fn init_messages(&self) -> Vec<Vec<u8>>;

    /// Messages to send right before closing the device.
    fn unload_messages(&self) -> Vec<Vec<u8>>;

    /// Message(s) that turn every LED off.
    fn clear_messages(&self) -> Vec<Vec<u8>>;

    /// Message(s) that set the given pads to the given RGB colours.
    fn color_messages(&self, pads: &[(u8, u8, Color)]) -> Vec<Vec<u8>>;

    /// Message(s) that set the given pads to palette / flashing / pulsing /
    /// RGB colours. The default reduces everything to RGB for devices without
    /// palette modes; RGB models override it.
    fn led_messages(&self, leds: &[(u8, u8, LedColor)]) -> Vec<Vec<u8>> {
        let rgb: Vec<(u8, u8, Color)> = leds.iter().map(|(x, y, c)| (*x, *y, c.rgb())).collect();
        self.color_messages(&rgb)
    }

    /// Layout coordinate -> (note/cc number, is_cc)
    fn xy_to_note(&self, x: u8, y: u8) -> Option<(u8, bool)>;

    /// note/cc number -> layout coordinate
    fn note_to_xy(&self, note: u8, cc: bool) -> Option<(u8, u8)>;

    /// Minimum Note On velocity that counts as a press. Velocity-sensitive
    /// models use a higher threshold to ignore accidental brushes.
    fn press_threshold(&self) -> u8 {
        1
    }

    /// Translate a raw incoming message into a button event with the model's threshold.
    fn parse_input(&self, msg: &[u8]) -> Option<ButtonEvent> {
        self.parse_input_with(msg, self.press_threshold())
    }

    /// Translate a raw incoming message into a button event; `threshold` is
    /// the lowest Note On velocity that counts as a press.
    fn parse_input_with(&self, msg: &[u8], threshold: u8) -> Option<ButtonEvent> {
        if msg.len() < 3 {
            return None;
        }
        let threshold = threshold.max(1);
        let status = msg[0] & 0xF0;
        let number = msg[1];
        let value = msg[2];
        let (cc, pressed) = match status {
            0x90 => (false, value >= threshold),
            0x80 => (false, false),
            0xB0 => (true, value > 0),
            _ => return None,
        };
        // A Note On below the threshold but above zero is neither press nor
        // release: ignore it so a light brush does not release a held button.
        if status == 0x90 && value > 0 && value < threshold {
            return None;
        }
        let (x, y) = self.note_to_xy(number, cc)?;
        Some(ButtonEvent { x, y, pressed, note: number, cc, value })
    }

    /// A knob or touch strip movement; only models with such controls report any.
    fn parse_control(&self, _msg: &[u8]) -> Option<ControlEvent> {
        None
    }

    /// True when the device reports on a second input interface as well: the
    /// Launchkey's keys arrive on its MIDI interface while the app talks to
    /// the DAW one. The manager opens that interface too and feeds its
    /// messages to [`parse_secondary_input`](Self::parse_secondary_input).
    fn has_secondary_input(&self) -> bool {
        false
    }

    /// Translate a message from the secondary interface into a button event.
    fn parse_secondary_input(&self, _msg: &[u8], _threshold: u8) -> Option<ButtonEvent> {
        None
    }

    /// A control movement reported on the secondary interface (the Launchkey strips).
    fn parse_secondary_control(&self, _msg: &[u8]) -> Option<ControlEvent> {
        None
    }

    /// A button the device reports as one event only (a toggle it confirms
    /// once): the manager adds the release right after the press.
    fn momentary(&self, _event: &ButtonEvent) -> bool {
        false
    }

    /// Messages to send straight back in answer to one the device sent: a
    /// Launchkey MK4 reports layout and feature changes made on the device
    /// itself, and its driver puts them back so the surface stays the app's.
    fn react(&self, _msg: &[u8]) -> Vec<Vec<u8>> {
        Vec::new()
    }

    /// Aftertouch: polyphonic key pressure (`A0`) names the pad, channel
    /// pressure (`D0`) applies to every pad currently held.
    fn parse_pressure(&self, msg: &[u8], held: &[(u8, u8)]) -> Vec<PressureEvent> {
        match msg.first().map(|s| s & 0xF0) {
            Some(0xA0) if msg.len() >= 3 => self.note_to_xy(msg[1], false).map(|(x, y)| vec![PressureEvent { x, y, value: msg[2] }]).unwrap_or_default(),
            Some(0xD0) if msg.len() >= 2 => held.iter().map(|&(x, y)| PressureEvent { x, y, value: msg[1] }).collect(),
            _ => Vec::new(),
        }
    }
}

pub fn driver_for(model: LaunchpadModel) -> Box<dyn LaunchpadDriver> {
    match model {
        LaunchpadModel::LaunchpadMk2 => Box::new(mk2::Mk2),
        LaunchpadModel::LaunchpadX => Box::new(x::LaunchpadX),
        LaunchpadModel::LaunchpadMiniMk3 => Box::new(mini_mk3::MiniMk3),
        LaunchpadModel::LaunchpadProMk2 => Box::new(pro_mk2::ProMk2),
        LaunchpadModel::LaunchpadProMk3 => Box::new(pro_mk3::ProMk3),
        LaunchpadModel::LaunchpadLegacy => Box::new(legacy::Legacy),
        LaunchpadModel::LaunchkeyMiniMk3 => Box::new(launchkey_mini_mk3::LaunchkeyMiniMk3),
        LaunchpadModel::LaunchkeyMiniMk4 => Box::new(launchkey_mini_mk4::LaunchkeyMiniMk4),
    }
}

/// Helper: build a `PadSpec` from a driver's mapping.
pub(crate) fn spec(
    driver: &dyn LaunchpadDriver,
    x: u8,
    y: u8,
    shape: PadShape,
    region: PadRegion,
    label: Option<&str>,
) -> PadSpec {
    let (note, cc) = match shape {
        PadShape::Empty => (None, false),
        _ => driver
            .xy_to_note(x, y)
            .map(|(n, cc)| (Some(n), cc))
            .unwrap_or((None, false)),
    };
    let led = match shape {
        PadShape::Empty | PadShape::Knob | PadShape::Strip | PadShape::KeyWhite | PadShape::KeyBlack => LedKind::None,
        _ => LedKind::Rgb,
    };
    // Function buttons light their printed symbol only (the Launchkey's rounded ones, the
    // square ones around a Launchpad's grid and the Pro MK3's Shift); pads light all over.
    let mask = matches!(shape, PadShape::Rect | PadShape::SmallRect | PadShape::TallRect | PadShape::Square | PadShape::Small);
    PadSpec { x, y, shape, region, label: label.map(|s| s.to_string()), note, cc, led, rows: 1, cols: 1, edge: PadEdge::Free, mask, centred: false, momentary: false }
}

/// Shared LED builder for MK2 / Pro MK2 (`0A` solid, `23` flash, `28` pulse,
/// `0B` RGB with 0..63 channels). Flashing sends the base colour as solid and
/// the alternate through the flash command ("flash between the chosen colour
/// and its current colour"). Flash and pulse entries carry a reserved mode
/// byte (`00`) before the LED number: the MK2 manual's decimal listing and
/// summary table show `23h 00h <LED> <Colour>`; the hex line omits it.
pub(crate) fn mk2_style_led_messages(
    header: &[u8],
    max_per_msg: usize,
    // MK2: flash/pulse entries are `00 <LED> <Colour>`; Pro (MK2): `<LED> <Colour>`.
    mode_byte: bool,
    leds: &[(u8, u8, LedColor)],
    map: impl Fn(u8, u8) -> Option<(u8, bool)>,
) -> Vec<Vec<u8>> {
    let mut solid: Vec<u8> = Vec::new();
    let mut flash: Vec<u8> = Vec::new();
    let mut pulse: Vec<u8> = Vec::new();
    let mut rgb: Vec<u8> = Vec::new();
    for (x, y, c) in leds {
        let Some((led, _)) = map(*x, *y) else { continue };
        match *c {
            LedColor::Off => solid.extend_from_slice(&[led, 0]),
            LedColor::Palette(i) => solid.extend_from_slice(&[led, i.min(127)]),
            LedColor::Flashing { index, alt } => {
                solid.extend_from_slice(&[led, index.min(127)]);
                if mode_byte {
                    flash.push(0x00);
                }
                flash.extend_from_slice(&[led, alt.min(127)]);
            }
            LedColor::Pulsing(i) => {
                if mode_byte {
                    pulse.push(0x00);
                }
                pulse.extend_from_slice(&[led, i.min(127)]);
            }
            LedColor::Rgb(c) => rgb.extend_from_slice(&[led, c.r / 4, c.g / 4, c.b / 4]),
        }
    }
    let mut out = Vec::new();
    let mut push = |cmd: u8, data: &[u8], width: usize| {
        for chunk in data.chunks(width * max_per_msg) {
            let mut body = vec![cmd];
            body.extend_from_slice(chunk);
            out.push(sysex(header, &body));
        }
    };
    let entry = if mode_byte { 3 } else { 2 };
    push(0x0A, &solid, 2);
    push(0x23, &flash, entry);
    push(0x28, &pulse, entry);
    push(0x0B, &rgb, 4);
    out
}

/// Shared LED builder for X / Mini MK3 / Pro MK3: one `03` message with typed
/// colour specs (0 static, 1 flashing, 2 pulsing, 3 RGB with 0..127 channels).
pub(crate) fn mk3_style_led_messages(
    header: &[u8],
    max_per_msg: usize,
    leds: &[(u8, u8, LedColor)],
    map: impl Fn(u8, u8) -> Option<(u8, bool)>,
) -> Vec<Vec<u8>> {
    let mut specs: Vec<Vec<u8>> = Vec::with_capacity(leds.len());
    for (x, y, c) in leds {
        let Some((led, _)) = map(*x, *y) else { continue };
        specs.push(match *c {
            LedColor::Off => vec![0x00, led, 0x00],
            LedColor::Palette(i) => vec![0x00, led, i.min(127)],
            LedColor::Flashing { index, alt } => vec![0x01, led, alt.min(127), index.min(127)],
            LedColor::Pulsing(i) => vec![0x02, led, i.min(127)],
            LedColor::Rgb(c) => vec![0x03, led, c.r / 2, c.g / 2, c.b / 2],
        });
    }
    specs
        .chunks(max_per_msg)
        .map(|chunk| {
            let mut body = vec![0x03];
            for spec in chunk {
                body.extend_from_slice(spec);
            }
            sysex(header, &body)
        })
        .collect()
}

/// Helper: wrap `body` in a Novation SysEx frame.
pub(crate) fn sysex(header: &[u8], body: &[u8]) -> Vec<u8> {
    let mut msg = Vec::with_capacity(header.len() + body.len() + 2);
    msg.push(0xF0);
    msg.extend_from_slice(header);
    msg.extend_from_slice(body);
    msg.push(0xF7);
    msg
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Every model must round-trip every pressable pad in its own layout.
    #[test]
    fn layouts_round_trip() {
        for model in LaunchpadModel::ALL {
            let driver = driver_for(model);
            let layout = driver.layout();
            assert_eq!(layout.row_weights.len(), layout.height as usize, "{model}");
            for pad in &layout.pads {
                if matches!(pad.shape, PadShape::Empty | PadShape::Logo) {
                    continue;
                }
                // Printed buttons that send nothing (keyboard functions) and strips not read yet
                // carry no note; every square pad must.
                if pad.note.is_none() {
                    assert_ne!(pad.shape, PadShape::Pad, "{model}: pad ({}, {}) without a note", pad.x, pad.y);
                    continue;
                }
                let (note, cc) = driver
                    .xy_to_note(pad.x, pad.y)
                    .unwrap_or_else(|| panic!("{model}: no note for ({}, {})", pad.x, pad.y));
                assert_eq!(pad.note, Some(note), "{model} ({}, {})", pad.x, pad.y);
                assert_eq!(pad.cc, cc, "{model} ({}, {})", pad.x, pad.y);
                let back = driver.note_to_xy(note, cc);
                assert_eq!(back, Some((pad.x, pad.y)), "{model}: note {note} cc={cc}");
            }
        }
    }

    #[test]
    fn led_messages_cover_all_modes() {
        let leds = [
            (0u8, 0u8, LedColor::Palette(5)),
            (1, 0, LedColor::Flashing { index: 5, alt: 21 }),
            (2, 0, LedColor::Pulsing(45)),
            (3, 0, LedColor::Rgb(Color::new(255, 0, 0))),
            (4, 0, LedColor::Off),
        ];
        for model in LaunchpadModel::ALL {
            let driver = driver_for(model);
            // Models whose grid does not start at (0, 0) get the same modes on their first RGB pads.
            let layout = driver.layout();
            let first = layout.pads.iter().filter(|p| p.shape == PadShape::Pad).min_by_key(|p| (p.y, p.x)).expect("a pad");
            let shifted: Vec<(u8, u8, LedColor)> = leds.iter().map(|(x, y, c)| (first.x + x, first.y + y, *c)).collect();
            let msgs = driver.led_messages(&shifted);
            assert!(!msgs.is_empty(), "{model}");
            for m in &msgs {
                assert!(m.iter().skip(1).all(|b| *b < 0x80 || *b == 0xF7), "{model}: data byte >= 0x80 in {m:02X?}");
            }
        }
        let mk2 = driver_for(LaunchpadModel::LaunchpadMk2).led_messages(&leds);
        assert_eq!(mk2[0], vec![0xF0, 0x00, 0x20, 0x29, 0x02, 0x18, 0x0A, 11, 5, 12, 5, 15, 0, 0xF7]);
        assert_eq!(mk2[1], vec![0xF0, 0x00, 0x20, 0x29, 0x02, 0x18, 0x23, 0x00, 12, 21, 0xF7]);
        assert_eq!(mk2[2], vec![0xF0, 0x00, 0x20, 0x29, 0x02, 0x18, 0x28, 0x00, 13, 45, 0xF7]);
        assert_eq!(mk2[3], vec![0xF0, 0x00, 0x20, 0x29, 0x02, 0x18, 0x0B, 14, 63, 0, 0, 0xF7]);
        // Pro (MK2): grid starts at x=1,y=1 (note 11) and flash/pulse have no mode byte.
        let pro = driver_for(LaunchpadModel::LaunchpadProMk2).led_messages(&[(1, 1, LedColor::Flashing { index: 5, alt: 21 }), (2, 1, LedColor::Pulsing(45))]);
        assert_eq!(pro[1], vec![0xF0, 0x00, 0x20, 0x29, 0x02, 0x10, 0x23, 11, 21, 0xF7]);
        assert_eq!(pro[2], vec![0xF0, 0x00, 0x20, 0x29, 0x02, 0x10, 0x28, 12, 45, 0xF7]);
    }

    #[test]
    fn layouts_have_unique_coordinates() {
        for model in LaunchpadModel::ALL {
            let layout = driver_for(model).layout();
            let mut seen = std::collections::HashSet::new();
            for pad in &layout.pads {
                assert!(pad.x < layout.width && pad.y < layout.height, "{model}");
                // A control spanning several rows or columns covers the cells below and right of its anchor.
                for r in 0..pad.rows {
                    for c in 0..pad.cols {
                        assert!(pad.y >= r && pad.x + c < layout.width, "{model}: ({}, {}) spans past the edge", pad.x, pad.y);
                        assert!(seen.insert((pad.x + c, pad.y - r)), "{model}: duplicate ({}, {})", pad.x + c, pad.y - r);
                    }
                }
            }
            assert_eq!(seen.len(), (layout.width as usize) * (layout.height as usize), "{model}");
        }
    }
}
