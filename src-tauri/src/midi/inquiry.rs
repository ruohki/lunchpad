//! Universal Device Inquiry (MIDI SysEx) helpers.
//!
//! Every Launchpad since the Launchpad S answers the standard inquiry
//! `F0 7E 7F 06 01 F7` with
//! `F0 7E <dev> 06 02 00 20 29 <family lsb> <family msb> <member lsb> <member msb> <v1..v4> F7`.
//! This module parses those replies; the actual probing lives in [`super::scan`].

use super::types::{hex, LaunchpadModel};

/// The inquiry request, broadcast to "all devices" (`7F`).
pub const DEVICE_INQUIRY: [u8; 6] = [0xF0, 0x7E, 0x7F, 0x06, 0x01, 0xF7];

/// Novation manufacturer id.
const NOVATION_ID: [u8; 3] = [0x00, 0x20, 0x29];

/// A parsed inquiry reply from a Novation device.
#[derive(Debug, Clone)]
pub struct InquiryReply {
    /// Family code, least significant byte
    pub family: u8,
    /// Family code, most significant byte
    pub family_msb: u8,
    pub member: u8,
    pub firmware: String,
    pub raw: Vec<u8>,
}

impl InquiryReply {
    pub fn model(&self) -> Option<LaunchpadModel> {
        LaunchpadModel::from_inquiry_family(self.family, self.family_msb)
    }

    pub fn raw_hex(&self) -> String {
        hex(&self.raw)
    }
}

/// True if `msg` looks like *any* Universal Device Inquiry reply.
pub fn is_inquiry_reply(msg: &[u8]) -> bool {
    msg.len() >= 6 && msg[0] == 0xF0 && msg[1] == 0x7E && msg[3] == 0x06 && msg[4] == 0x02
}

/// Parse an inquiry reply. Returns `None` for non-Novation devices.
pub fn parse_inquiry_reply(msg: &[u8]) -> Option<InquiryReply> {
    if !is_inquiry_reply(msg) || msg.len() < 12 {
        return None;
    }
    if msg[5..8] != NOVATION_ID {
        return None;
    }
    let family = msg[8];
    let family_msb = msg[9];
    let member = msg[10];
    // Everything between the 4 id bytes and the closing F7 is the version.
    let end = if *msg.last().unwrap_or(&0) == 0xF7 { msg.len() - 1 } else { msg.len() };
    let version: Vec<String> = msg[12..end].iter().map(|b| b.to_string()).collect();
    let firmware = if version.is_empty() { String::new() } else { version.join(".") };
    Some(InquiryReply {
        family,
        family_msb,
        member,
        firmware,
        raw: msg.to_vec(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_real_mk2_reply() {
        // Captured from a Launchpad MK2 on macOS.
        let reply = [
            0xF0, 0x7E, 0x00, 0x06, 0x02, 0x00, 0x20, 0x29, 0x69, 0x00, 0x00, 0x00, 0x00, 0x01,
            0x07, 0x01, 0xF7,
        ];
        let parsed = parse_inquiry_reply(&reply).expect("valid reply");
        assert_eq!(parsed.model(), Some(LaunchpadModel::LaunchpadMk2));
        assert_eq!(parsed.firmware, "0.1.7.1");
    }

    #[test]
    fn rejects_other_manufacturers() {
        let reply = [
            0xF0, 0x7E, 0x00, 0x06, 0x02, 0x41, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00,
            0x00, 0x00, 0xF7,
        ];
        assert!(parse_inquiry_reply(&reply).is_none());
    }

    #[test]
    fn real_launchpad_x_reply() {
        // Captured from a Launchpad X on 2026-09-10: family 03 01, firmware 0.2.3.8.
        let msg = [0xF0, 0x7E, 0x00, 0x06, 0x02, 0x00, 0x20, 0x29, 0x03, 0x01, 0x00, 0x00, 0x00, 0x02, 0x03, 0x08, 0xF7];
        let reply = parse_inquiry_reply(&msg).expect("novation reply");
        assert_eq!(reply.model(), Some(LaunchpadModel::LaunchpadX));
        assert_eq!(reply.firmware, "0.2.3.8");
        // The manuals' `13 01` is taken as the Mini MK3 and `23 01` as the Pro MK3 (unverified;
        // the scanner lets the port name override all three).
        let documented = [0xF0, 0x7E, 0x00, 0x06, 0x02, 0x00, 0x20, 0x29, 0x13, 0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0xF7];
        assert_eq!(parse_inquiry_reply(&documented).unwrap().model(), Some(LaunchpadModel::LaunchpadMiniMk3));
        let pro = [0xF0, 0x7E, 0x00, 0x06, 0x02, 0x00, 0x20, 0x29, 0x23, 0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0xF7];
        assert_eq!(parse_inquiry_reply(&pro).unwrap().model(), Some(LaunchpadModel::LaunchpadProMk3));
    }

    #[test]
    fn real_launchkey_mini_mk4_reply() {
        // Captured from a Launchkey Mini MK4 25 on 2026-09-14 (MIDI interface; the DAW one answers member 00 01).
        let msg = [0xF0, 0x7E, 0x00, 0x06, 0x02, 0x00, 0x20, 0x29, 0x41, 0x01, 0x00, 0x00, 0x01, 0x01, 0x09, 0x5C, 0xF7];
        let reply = parse_inquiry_reply(&msg).expect("novation reply");
        assert_eq!(reply.model(), Some(LaunchpadModel::LaunchkeyMiniMk4));
        let daw = [0xF0, 0x7E, 0x00, 0x06, 0x02, 0x00, 0x20, 0x29, 0x41, 0x01, 0x00, 0x01, 0x01, 0x01, 0x09, 0x5C, 0xF7];
        assert_eq!(parse_inquiry_reply(&daw).unwrap().model(), Some(LaunchpadModel::LaunchkeyMiniMk4));
    }
}

