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
    /// Launchkey Mini MK3: 16 RGB pads, 8 knobs, two touch strips, a few buttons
    LaunchkeyMiniMk3,
    /// Launchkey Mini MK4: the same surface with aftertouch on the pads and a screen
    LaunchkeyMiniMk4,
}

impl LaunchpadModel {
    pub const ALL: [LaunchpadModel; 8] = [
        LaunchpadModel::LaunchpadMk2,
        LaunchpadModel::LaunchpadX,
        LaunchpadModel::LaunchpadMiniMk3,
        LaunchpadModel::LaunchpadProMk2,
        LaunchpadModel::LaunchpadProMk3,
        LaunchpadModel::LaunchpadLegacy,
        LaunchpadModel::LaunchkeyMiniMk3,
        LaunchpadModel::LaunchkeyMiniMk4,
    ];

    pub fn display_name(&self) -> &'static str {
        match self {
            LaunchpadModel::LaunchpadMk2 => "Launchpad MK2",
            LaunchpadModel::LaunchpadX => "Launchpad X",
            LaunchpadModel::LaunchpadMiniMk3 => "Launchpad Mini MK3",
            LaunchpadModel::LaunchpadProMk2 => "Launchpad Pro MK2",
            LaunchpadModel::LaunchpadProMk3 => "Launchpad Pro MK3",
            LaunchpadModel::LaunchpadLegacy => "Launchpad S / Mini / MK1",
            LaunchpadModel::LaunchkeyMiniMk3 => "Launchkey Mini MK3",
            LaunchpadModel::LaunchkeyMiniMk4 => "Launchkey Mini MK4",
        }
    }

    /// Identify a model from the bytes of a Universal Device Inquiry reply.
    ///
    /// Reply layout (Novation): `F0 7E <dev> 06 02 00 20 29 <family lsb> <family msb>
    /// <member lsb> <member msb> <v1> <v2> <v3> <v4> F7`
    ///
    /// Verified on hardware: MK2 replies `69 00 00 00`, a Launchpad X `03 01`
    /// (its manual prints `13 01`), a Launchkey Mini MK4 25 `41 01`. The Mini
    /// MK3 and Pro MK3 manuals print `13 01` as well, so the third generation is
    /// taken as `03` X, `13` Mini MK3, `23` Pro MK3 until a device of each has
    /// been seen; the scanner lets the port name override any of the three.
    pub fn from_inquiry_family(family_lsb: u8, family_msb: u8) -> Option<Self> {
        match (family_lsb, family_msb) {
            (0x69, _) => Some(LaunchpadModel::LaunchpadMk2),
            (0x51, _) => Some(LaunchpadModel::LaunchpadProMk2),
            (0x03, 0x01) => Some(LaunchpadModel::LaunchpadX),
            (0x13, 0x01) => Some(LaunchpadModel::LaunchpadMiniMk3),
            (0x23, 0x01) => Some(LaunchpadModel::LaunchpadProMk3),
            (0x41, 0x01) => Some(LaunchpadModel::LaunchkeyMiniMk4),
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
        if n.contains("launchkey mini mk4") || n.contains("lkmk4") && n.contains("mini") {
            return Some(LaunchpadModel::LaunchkeyMiniMk4);
        }
        if n.contains("launchkey mini") || n.contains("lkmk3") && n.contains("mini") {
            return Some(LaunchpadModel::LaunchkeyMiniMk3);
        }
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
    /// Rotary knob: sends a continuous value, no LED (Launchkey)
    Knob,
    /// Touch strip: a continuous value along a bar, no LED (Launchkey)
    Strip,
    /// Rounded rectangular button, wider than tall (Launchkey)
    Rect,
    /// Rounded rectangular button as wide as a `Rect` but as tall as the rows it
    /// spans (the Launchkey MK4's Track arrows, > and Func)
    TallRect,
    /// Smaller rounded rectangular button (the function buttons beside the
    /// Launchkey's encoders: Arp, Scale, the mode arrows)
    SmallRect,
    /// White piano key, no LED (Launchkey)
    KeyWhite,
    /// Black piano key, no LED; placed at the `x` of the white key to its left (Launchkey)
    KeyBlack,
}

/// What a control can show.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub enum LedKind {
    /// Full colour
    #[default]
    Rgb,
    /// A single white (or fixed-colour) LED: colours become a brightness
    White,
    /// Nothing to light: colour settings do not apply
    None,
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

/// Where a button smaller than its cell sits: centred, or against the top or bottom edge.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PadEdge {
    #[default]
    Free,
    Top,
    Bottom,
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
    /// What the control can light up.
    #[serde(default)]
    pub led: LedKind,
    /// Rows the control spans downwards from `y` (touch strips); 1 for everything else.
    #[serde(default = "one")]
    pub rows: u8,
    /// Columns the control spans rightwards from `x` (the Launchkey MK4's screen); 1 otherwise.
    #[serde(default = "one")]
    pub cols: u8,
    /// For a button smaller than its cell: the edge of the cell it sits against, so a
    /// stack of them lines up with the pad rows beside it.
    #[serde(default)]
    pub edge: PadEdge,
    /// The LED lights only the printed symbol or text, not the whole button.
    #[serde(default)]
    pub mask: bool,
    /// Rests in the middle and springs back when released (a pitch strip or
    /// slider). The interface draws its level as a bar rather than a fill.
    #[serde(default)]
    pub centred: bool,
}

fn one() -> u8 {
    1
}

impl PadSpec {
    pub fn with_led(mut self, led: LedKind) -> Self {
        self.led = led;
        self
    }

    /// Marks a control that springs back to the middle (the pitch strip).
    pub fn centred(mut self) -> Self {
        self.centred = true;
        self
    }

    pub fn with_rows(mut self, rows: u8) -> Self {
        self.rows = rows.max(1);
        self
    }

    pub fn with_cols(mut self, cols: u8) -> Self {
        self.cols = cols.max(1);
        self
    }

    /// Marks a button whose LED lights only its printed symbol.
    pub fn masked(mut self) -> Self {
        self.mask = true;
        self
    }

    pub fn at_top(mut self) -> Self {
        self.edge = PadEdge::Top;
        self
    }

    pub fn at_bottom(mut self) -> Self {
        self.edge = PadEdge::Bottom;
        self
    }

    /// A printed button that sends nothing the app can use (keyboard functions).
    pub fn without_input(mut self) -> Self {
        self.note = None;
        self.cc = false;
        self
    }
}

/// A knob or touch strip moved: `value` runs 0..1 over the control's travel.
#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ControlEvent {
    pub x: u8,
    pub y: u8,
    pub value: f32,
    /// The control returned to its rest position on its own (a sprung pitch
    /// strip let go): the level follows it, but a fader's actions run for the
    /// value it was let go at, not for this one.
    #[serde(default)]
    pub released: bool,
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
