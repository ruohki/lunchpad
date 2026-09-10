//! Shared MIDI/Launchpad types that cross the Rust <-> frontend boundary.
//!
//! Coordinate convention (matches Novation's programmer references and the
//! legacy Lunchpad configs): `x` counts from the LEFT, `y` counts from the
//! BOTTOM. `(0, 0)` is the bottom-left pad of the 8x8 grid on every model.

use serde::{Deserialize, Serialize};

/// Every Launchpad generation the app knows how to drive.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum LaunchpadModel {
    /// Launchpad MK2 (RGB, 8x8 + top row + right column)
    LaunchpadMk2,
    /// Launchpad X (RGB, velocity sensitive, 8x8 + top row + right column)
    LaunchpadX,
    /// Launchpad Mini MK3 (RGB, 8x8 + top row + right column)
    LaunchpadMiniMk3,
    /// Launchpad Pro (MK2) (RGB, buttons on all four sides)
    LaunchpadProMk2,
    /// Launchpad Pro MK3 (RGB, buttons on all four sides + extra bottom row)
    LaunchpadProMk3,
    /// Launchpad S / MK1 / Mini MK1 / Mini MK2 (red+green LEDs only)
    LaunchpadLegacy,
}

impl LaunchpadModel {
    pub const ALL: [LaunchpadModel; 6] = [
        LaunchpadModel::LaunchpadMk2,
        LaunchpadModel::LaunchpadX,
        LaunchpadModel::LaunchpadMiniMk3,
        LaunchpadModel::LaunchpadProMk2,
        LaunchpadModel::LaunchpadProMk3,
        LaunchpadModel::LaunchpadLegacy,
    ];

    pub fn display_name(&self) -> &'static str {
        match self {
            LaunchpadModel::LaunchpadMk2 => "Launchpad MK2",
            LaunchpadModel::LaunchpadX => "Launchpad X",
            LaunchpadModel::LaunchpadMiniMk3 => "Launchpad Mini MK3",
            LaunchpadModel::LaunchpadProMk2 => "Launchpad Pro MK2",
            LaunchpadModel::LaunchpadProMk3 => "Launchpad Pro MK3",
            LaunchpadModel::LaunchpadLegacy => "Launchpad S / Mini / MK1",
        }
    }

    /// Identify a model from the bytes of a Universal Device Inquiry reply.
    ///
    /// Reply layout (Novation): `F0 7E <dev> 06 02 00 20 29 <family lsb> <family msb>
    /// <member lsb> <member msb> <v1> <v2> <v3> <v4> F7`
    ///
    /// Verified on hardware: MK2 replies `69 00 00 00`.
    /// The other ids come from Novation's programmer references.
    /// Model from the two family bytes of the inquiry reply (LSB, MSB). The
    /// X, Mini MK3 and Pro MK3 manuals all print `13 01` and a real Launchpad X
    /// answers `03 01`, so the third generation maps to the X here and the
    /// scanner refines it by port name.
    pub fn from_inquiry_family(family_lsb: u8, family_msb: u8) -> Option<Self> {
        match (family_lsb, family_msb) {
            (0x69, _) => Some(LaunchpadModel::LaunchpadMk2),
            (0x51, _) => Some(LaunchpadModel::LaunchpadProMk2),
            (0x03 | 0x13 | 0x23, 0x01) => Some(LaunchpadModel::LaunchpadX),
            // Launchpad S and Launchpad Mini (MK1/MK2)
            (0x20, _) | (0x36, _) => Some(LaunchpadModel::LaunchpadLegacy),
            _ => None,
        }
    }

    /// Fallback identification from the operating system's port name, used for
    /// devices that do not answer the inquiry (e.g. the original Launchpad MK1)
    /// or when the inquiry times out.
    pub fn from_port_name(name: &str) -> Option<Self> {
        let n = name.to_lowercase();
        if !n.contains("launchpad") {
            return None;
        }
        if n.contains("pro mk3") || n.contains("lppromk3") {
            Some(LaunchpadModel::LaunchpadProMk3)
        } else if n.contains("mini mk3") || n.contains("lpminimk3") {
            Some(LaunchpadModel::LaunchpadMiniMk3)
        } else if n.contains("launchpad x") || n.contains("lpx") {
            Some(LaunchpadModel::LaunchpadX)
        } else if n.contains("launchpad pro") {
            Some(LaunchpadModel::LaunchpadProMk2)
        } else if n.contains("mk2") {
            Some(LaunchpadModel::LaunchpadMk2)
        } else if n.contains("launchpad s") || n.contains("mini") || n == "launchpad" {
            Some(LaunchpadModel::LaunchpadLegacy)
        } else {
            None
        }
    }
}

impl std::fmt::Display for LaunchpadModel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.display_name())
    }
}

/// Aftertouch while a pad is held (X, Pro, Pro MK3): 0-127.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PressureEvent {
    pub x: u8,
    pub y: u8,
    pub value: u8,
}

/// A MIDI port as reported by the OS.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MidiPortInfo {
    pub index: usize,
    pub name: String,
}

/// How a scanned device was identified.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum IdentificationSource {
    /// The device answered a Universal Device Inquiry with a known Novation id.
    DeviceInquiry,
    /// Identified from the port name only (no or unknown inquiry reply).
    PortName,
}

/// A Launchpad found by [`scan_launchpads`](crate::midi::scan::scan_launchpads).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredLaunchpad {
    pub model: LaunchpadModel,
    pub model_name: String,
    pub input: MidiPortInfo,
    pub output: MidiPortInfo,
    pub firmware: Option<String>,
    pub identified_by: IdentificationSource,
    /// Raw inquiry reply (hex) for diagnostics.
    pub inquiry_reply: Option<String>,
    /// True if this pair is the one currently connected.
    pub connected: bool,
}

/// Physical shape of a control on the device.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PadShape {
    /// Square RGB pad of the main 8x8 grid
    Pad,
    /// Round / rectangular function button on the edges
    Round,
    /// Smaller button (e.g. Pro MK3 shift)
    Small,
    /// LED-only spot that cannot be pressed (e.g. Launchpad X logo)
    Logo,
    /// No control at this coordinate (corners)
    Empty,
}

/// Which region of the device a control belongs to.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PadRegion {
    Grid,
    Top,
    Right,
    Bottom,
    Left,
    /// Second row below the grid on the Pro MK3
    Bottom2,
    Other,
}

/// One control of a model layout.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PadSpec {
    pub x: u8,
    pub y: u8,
    pub shape: PadShape,
    pub region: PadRegion,
    /// Label printed on the hardware, if any (e.g. "Session", "▲").
    pub label: Option<String>,
    /// MIDI note / CC number used by the device for this control.
    pub note: Option<u8>,
    /// True if the control speaks Control Change instead of Note messages.
    pub cc: bool,
}

/// Complete description of a model's button matrix, consumed by the UI.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Layout {
    pub model: LaunchpadModel,
    pub model_name: String,
    /// Number of columns (x: 0..width)
    pub width: u8,
    /// Number of rows (y: 0..height, 0 = bottom)
    pub height: u8,
    /// Relative row heights from bottom to top (Pro MK3 has two smaller rows)
    pub row_weights: Vec<f32>,
    pub pads: Vec<PadSpec>,
    /// Only red/green LEDs (Launchpad S / MK1 / Mini)
    pub limited_color: bool,
    /// Pads report how hard they were hit (X, Pro MK2, Pro MK3)
    #[serde(default)]
    pub velocity_sensitive: bool,
}

/// RGB colour, 0-255 per channel. Models scale it to their own range.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default, Serialize, Deserialize)]
pub struct Color {
    pub r: u8,
    pub g: u8,
    pub b: u8,
}

impl Color {
    pub const OFF: Color = Color { r: 0, g: 0, b: 0 };
    pub const fn new(r: u8, g: u8, b: u8) -> Self {
        Color { r, g, b }
    }
}

/// What an LED should show, in the vocabulary every RGB Launchpad understands.
/// Palette indices refer to Novation's 128-colour table (`midi::palette`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum LedColor {
    Off,
    Palette(u8),
    /// Alternates between `index` and `alt`
    Flashing { index: u8, alt: u8 },
    Pulsing(u8),
    Rgb(Color),
}

impl LedColor {
    /// Representative solid colour (for devices without palette modes).
    pub fn rgb(&self) -> Color {
        match *self {
            LedColor::Off => Color::OFF,
            LedColor::Palette(i) | LedColor::Flashing { index: i, .. } | LedColor::Pulsing(i) => {
                crate::midi::palette::palette_color(i)
            }
            LedColor::Rgb(c) => c,
        }
    }
}

/// Press / release of a physical control, in layout coordinates.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ButtonEvent {
    pub x: u8,
    pub y: u8,
    pub pressed: bool,
    pub note: u8,
    pub cc: bool,
    /// Velocity / CC value as reported by the device
    pub value: u8,
}

/// Raw MIDI message forwarded to the UI monitor.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RawMidiEvent {
    pub timestamp: u64,
    pub bytes: Vec<u8>,
    pub hex: String,
}

/// Errors from the MIDI subsystem.
#[derive(Debug, thiserror::Error)]
pub enum MidiError {
    #[error("Failed to initialise MIDI: {0}")]
    Init(String),
    #[error("MIDI port not found: {0}")]
    PortNotFound(String),
    #[error("Failed to open MIDI port: {0}")]
    Connection(String),
    #[error("Failed to send MIDI message: {0}")]
    Send(String),
    #[error("No Launchpad is connected")]
    NotConnected,
    #[error("Device verification failed: {0}")]
    Verification(String),
    #[error("Failed to store settings: {0}")]
    Settings(String),
}

pub type MidiResult<T> = Result<T, MidiError>;

pub fn hex(bytes: &[u8]) -> String {
    bytes
        .iter()
        .map(|b| format!("{:02X}", b))
        .collect::<Vec<_>>()
        .join(" ")
}
