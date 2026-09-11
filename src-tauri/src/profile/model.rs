//! Profile data model, persisted as `profile.json`.
//!
//! A profile holds pages; a page holds buttons keyed by pad coordinate
//! (`x` from the left, `y` from the bottom). Only the active page is painted
//! on the device.

use crate::midi::palette::palette_color;
use crate::macros::Action;
use crate::midi::types::Color;
use serde::{Deserialize, Serialize};

pub const PROFILE_VERSION: u32 = 1;
pub const DEFAULT_PAGE_ID: &str = "default";

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub version: u32,
    pub active_page: String,
    pub pages: Vec<Page>,
}

impl Default for Profile {
    fn default() -> Self {
        Profile {
            version: PROFILE_VERSION,
            active_page: DEFAULT_PAGE_ID.into(),
            pages: vec![Page::new(DEFAULT_PAGE_ID, "Default")],
        }
    }
}

impl Profile {
    pub fn page(&self, id: &str) -> Option<&Page> {
        self.pages.iter().find(|p| p.id == id)
    }

    pub fn page_mut(&mut self, id: &str) -> Option<&mut Page> {
        self.pages.iter_mut().find(|p| p.id == id)
    }

    pub fn active(&self) -> Option<&Page> {
        self.page(&self.active_page).or_else(|| self.pages.first())
    }

    /// Make sure the profile is usable: at least one page, a valid active page.
    pub fn normalize(&mut self) {
        if self.pages.is_empty() {
            self.pages.push(Page::new(DEFAULT_PAGE_ID, "Default"));
        }
        if self.page(&self.active_page).is_none() {
            self.active_page = self.pages[0].id.clone();
        }
        self.version = PROFILE_VERSION;
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Page {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub buttons: Vec<PlacedButton>,
    /// Runs of pads acting as one control each; they take precedence over buttons underneath.
    #[serde(default)]
    pub faders: Vec<Fader>,
}

impl Page {
    pub fn new(id: impl Into<String>, name: impl Into<String>) -> Self {
        Page { id: id.into(), name: name.into(), buttons: Vec::new(), faders: Vec::new() }
    }

    /// The fader covering a pad and the pad's step within it.
    pub fn fader_at(&self, x: u8, y: u8) -> Option<(&Fader, usize)> {
        self.faders.iter().find_map(|f| f.step_of(x, y).map(|s| (f, s)))
    }

    pub fn fader_mut(&mut self, id: &str) -> Option<&mut Fader> {
        self.faders.iter_mut().find(|f| f.id == id)
    }

    /// Insert or replace a fader by id.
    pub fn set_fader(&mut self, fader: Fader) {
        match self.faders.iter_mut().find(|f| f.id == fader.id) {
            Some(slot) => *slot = fader,
            None => self.faders.push(fader),
        }
    }

    pub fn remove_fader(&mut self, id: &str) -> bool {
        let before = self.faders.len();
        self.faders.retain(|f| f.id != id);
        self.faders.len() != before
    }

    pub fn with_new_id(name: impl Into<String>) -> Self {
        Self::new(uuid::Uuid::new_v4().to_string(), name)
    }

    pub fn get(&self, x: u8, y: u8) -> Option<&Button> {
        self.buttons.iter().find(|b| b.x == x && b.y == y).map(|b| &b.button)
    }

    pub fn get_mut(&mut self, x: u8, y: u8) -> Option<&mut Button> {
        self.buttons.iter_mut().find(|b| b.x == x && b.y == y).map(|b| &mut b.button)
    }

    pub fn set(&mut self, x: u8, y: u8, button: Button) {
        match self.buttons.iter_mut().find(|b| b.x == x && b.y == y) {
            Some(slot) => slot.button = button,
            None => self.buttons.push(PlacedButton { x, y, button }),
        }
    }

    pub fn remove(&mut self, x: u8, y: u8) -> Option<Button> {
        let idx = self.buttons.iter().position(|b| b.x == x && b.y == y)?;
        Some(self.buttons.remove(idx).button)
    }

    pub fn swap(&mut self, a: (u8, u8), b: (u8, u8)) {
        let ba = self.remove(a.0, a.1);
        let bb = self.remove(b.0, b.1);
        if let Some(button) = ba {
            self.set(b.0, b.1, button);
        }
        if let Some(button) = bb {
            self.set(a.0, a.1, button);
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlacedButton {
    pub x: u8,
    pub y: u8,
    #[serde(flatten)]
    pub button: Button,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Button {
    pub look: Look,
    pub color: PadColor,
    /// Colour while a macro of this button runs, the pad is held, or the
    /// `state_link` condition holds.
    #[serde(default)]
    pub active_color: Option<PadColor>,
    /// Repeat the `down` actions until the macro is stopped.
    #[serde(default, rename = "loop")]
    pub loop_down: bool,
    #[serde(default)]
    pub down: Vec<Action>,
    #[serde(default)]
    pub up: Vec<Action>,
    /// Actions for a long press. With any set, `down` runs when a short press
    /// is released instead of at press time, and `hold` runs once the pad has
    /// been held for `hold_ms`.
    #[serde(default)]
    pub hold: Vec<Action>,
    #[serde(default = "default_hold_ms")]
    pub hold_ms: u64,
    /// With hold actions: wait until the press is known to be a tap before
    /// running `down` (true), or run `down` at once and add `hold` on top (false).
    #[serde(default = "default_true")]
    pub hold_wait: bool,
    /// Show the active colour while a streaming app is in a given state.
    #[serde(default)]
    pub state_link: Option<StateLink>,
}

fn default_true() -> bool {
    true
}

pub fn default_hold_ms() -> u64 {
    500
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FaderDirection {
    #[default]
    Up,
    Right,
    Down,
    Left,
}

/// A straight run of pads acting as one fader. Pressing a pad sets the value
/// by its position; the pads blend from `color_a` at the minimum to `color_b`
/// at the maximum and light up to the current level.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Fader {
    pub id: String,
    #[serde(default)]
    pub name: String,
    /// What macros read the level as (`fader.<variable>`); empty = derived from the name.
    #[serde(default)]
    pub variable: String,
    /// First pad (the minimum)
    pub x: u8,
    pub y: u8,
    #[serde(default)]
    pub direction: FaderDirection,
    /// Number of pads (at least 2)
    pub length: u8,
    #[serde(default = "default_color_a")]
    pub color_a: [u8; 3],
    #[serde(default = "default_color_b")]
    pub color_b: [u8; 3],
    /// Brightness (percent) of the pads above the level
    #[serde(default = "default_dim")]
    pub dim: u8,
    #[serde(default)]
    pub min: f64,
    #[serde(default = "default_max")]
    pub max: f64,
    /// Shown after the value (e.g. "%" or " dB")
    #[serde(default)]
    pub unit: String,
    #[serde(default)]
    pub decimals: u8,
    /// Current level, persisted
    #[serde(default)]
    pub value: f64,
    /// Show the level on another scale (e.g. -100..26 dB shown as 0..100 %)
    #[serde(default)]
    pub display: Option<FaderDisplay>,
    /// Runs after every change with `value`, `percent`, `fraction`, `step`, `steps`, `display`
    #[serde(default)]
    pub on_change: Vec<Action>,
}

/// A second scale the fader's value is shown in, mapped linearly from the range.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FaderDisplay {
    pub min: f64,
    pub max: f64,
    #[serde(default)]
    pub unit: String,
    #[serde(default)]
    pub decimals: u8,
}

fn default_color_a() -> [u8; 3] {
    [0, 96, 255]
}
fn default_color_b() -> [u8; 3] {
    [255, 64, 32]
}
fn default_dim() -> u8 {
    12
}
fn default_max() -> f64 {
    100.0
}

impl Default for Fader {
    fn default() -> Self {
        Fader {
            id: String::new(),
            name: String::new(),
            variable: String::new(),
            x: 0,
            y: 0,
            direction: FaderDirection::Up,
            length: 4,
            color_a: default_color_a(),
            color_b: default_color_b(),
            dim: default_dim(),
            min: 0.0,
            max: default_max(),
            unit: "%".into(),
            decimals: 0,
            value: 0.0,
            display: None,
            on_change: Vec::new(),
        }
    }
}

impl Fader {
    pub fn steps(&self) -> usize {
        self.length.max(2) as usize
    }

    /// The pads in order from the minimum; stops at the edge of the grid.
    /// The variable key: the variable name, else the name with spaces as underscores, else the id.
    pub fn variable_key(&self) -> String {
        let clean = |raw: &str| -> String { raw.trim().split_whitespace().collect::<Vec<_>>().join("_").chars().filter(|c| *c != '{' && *c != '}').collect() };
        let explicit = clean(&self.variable);
        if !explicit.is_empty() {
            return explicit;
        }
        let from_name = clean(&self.name);
        if !from_name.is_empty() {
            return from_name;
        }
        self.id.clone()
    }

    pub fn pads(&self) -> Vec<(u8, u8)> {
        let (dx, dy): (i16, i16) = match self.direction {
            FaderDirection::Up => (0, 1),
            FaderDirection::Right => (1, 0),
            FaderDirection::Down => (0, -1),
            FaderDirection::Left => (-1, 0),
        };
        (0..self.steps())
            .filter_map(|i| {
                let x = self.x as i16 + dx * i as i16;
                let y = self.y as i16 + dy * i as i16;
                (x >= 0 && y >= 0).then_some((x as u8, y as u8))
            })
            .collect()
    }

    pub fn step_of(&self, x: u8, y: u8) -> Option<usize> {
        self.pads().iter().position(|p| *p == (x, y))
    }

    fn t(&self, step: usize) -> f64 {
        step as f64 / (self.steps() - 1) as f64
    }

    pub fn value_at_step(&self, step: usize) -> f64 {
        self.min + (self.max - self.min) * self.t(step)
    }

    pub fn fraction(&self) -> f64 {
        if (self.max - self.min).abs() < f64::EPSILON {
            0.0
        } else {
            ((self.value - self.min) / (self.max - self.min)).clamp(0.0, 1.0)
        }
    }

    /// The pad that shows the current level.
    pub fn level_step(&self) -> usize {
        (self.fraction() * (self.steps() - 1) as f64).round() as usize
    }

    /// Blend of the two colours at a step.
    pub fn color_at(&self, step: usize) -> [u8; 3] {
        let t = self.t(step);
        let mix = |a: u8, b: u8| (a as f64 + (b as f64 - a as f64) * t).round().clamp(0.0, 255.0) as u8;
        [mix(self.color_a[0], self.color_b[0]), mix(self.color_a[1], self.color_b[1]), mix(self.color_a[2], self.color_b[2])]
    }

    /// What a pad shows: its blend up to the level, dimmed above it.
    pub fn pad_rgb(&self, step: usize) -> [u8; 3] {
        let c = self.color_at(step);
        if step <= self.level_step() {
            c
        } else {
            let k = self.dim.min(100) as f64 / 100.0;
            [(c[0] as f64 * k).round() as u8, (c[1] as f64 * k).round() as u8, (c[2] as f64 * k).round() as u8]
        }
    }

    /// The value on the display scale (the real value when there is none).
    pub fn display_value(&self) -> f64 {
        match &self.display {
            Some(d) => d.min + (d.max - d.min) * self.fraction(),
            None => self.value,
        }
    }

    /// The real value, formatted (what `{{value}}` carries).
    pub fn value_text(&self) -> String {
        format!("{:.*}", self.decimals as usize, self.value)
    }

    /// What the pad shows: the display scale with its unit, or the real value.
    pub fn display_text(&self) -> String {
        match &self.display {
            Some(d) => format!("{:.*}{}", d.decimals as usize, self.display_value(), d.unit),
            None => format!("{}{}", self.value_text(), self.unit),
        }
    }
}

/// Which streaming app a [`StateLink`] watches.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum LinkProvider {
    Obs,
    Slobs,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum LinkKind {
    /// `scene` is the live scene
    Scene,
    /// `source` is visible in `scene` (empty scene = the live scene)
    SourceVisible,
    /// `source` is muted
    SourceMuted,
    Streaming,
    Recording,
    ReplayBuffer,
}

/// "Active while …" binding of a button to the state of OBS or Streamlabs.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StateLink {
    pub provider: LinkProvider,
    pub kind: LinkKind,
    #[serde(default)]
    pub scene: String,
    #[serde(default)]
    pub source: String,
}

impl Default for Button {
    fn default() -> Self {
        Button {
            look: Look::Text { caption: String::new(), size: 16, face: "sans".into(), color: "#ffffff".into() },
            color: PadColor::Rgb { r: 0, g: 0, b: 0 },
            active_color: None,
            loop_down: false,
            down: Vec::new(),
            up: Vec::new(),
            hold: Vec::new(),
            hold_ms: default_hold_ms(),
            hold_wait: true,
            state_link: None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Look {
    Text {
        caption: String,
        /// Font size in px, relative to a 100 px pad
        #[serde(default = "default_size")]
        size: u16,
        /// Font family key (see the UI's face list), e.g. "sans", "serif", "mono"
        #[serde(default = "default_face")]
        face: String,
        #[serde(default = "default_text_color")]
        color: String,
    },
    Image {
        /// data: URI or absolute file path
        uri: String,
    },
}

fn default_size() -> u16 {
    16
}
fn default_face() -> String {
    "sans".into()
}
fn default_text_color() -> String {
    "#ffffff".into()
}

/// What a pad's LED shows. Palette indices refer to Novation's 128 colours.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "mode", rename_all = "camelCase")]
pub enum PadColor {
    Palette { index: u8 },
    Flashing { index: u8, alt: u8 },
    Pulsing { index: u8 },
    Rgb { r: u8, g: u8, b: u8 },
}

impl PadColor {
    /// Representative RGB colour (for the UI and for red/green devices).
    pub fn rgb(&self) -> Color {
        match *self {
            PadColor::Palette { index } | PadColor::Flashing { index, .. } | PadColor::Pulsing { index } => palette_color(index),
            PadColor::Rgb { r, g, b } => Color::new(r, g, b),
        }
    }

    pub fn is_off(&self) -> bool {
        self.rgb() == Color::OFF
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn profile_round_trip() {
        let mut p = Profile::default();
        let page = p.page_mut(DEFAULT_PAGE_ID).unwrap();
        page.set(0, 0, Button { color: PadColor::Palette { index: 5 }, ..Default::default() });
        page.set(1, 0, Button { color: PadColor::Flashing { index: 5, alt: 21 }, ..Default::default() });
        let json = serde_json::to_string_pretty(&p).unwrap();
        assert!(json.contains("\"mode\": \"flashing\""));
        assert!(json.contains("\"loop\": false"));
        let back: Profile = serde_json::from_str(&json).unwrap();
        assert_eq!(back, p);
    }

    #[test]
    fn page_swap_and_remove() {
        let mut page = Page::new("p", "P");
        page.set(0, 0, Button { color: PadColor::Palette { index: 1 }, ..Default::default() });
        page.swap((0, 0), (3, 3));
        assert!(page.get(0, 0).is_none());
        assert_eq!(page.get(3, 3).unwrap().color, PadColor::Palette { index: 1 });
        assert!(page.remove(3, 3).is_some());
        assert!(page.buttons.is_empty());
    }

    #[test]
    fn normalize_fixes_missing_active_page() {
        let mut p = Profile { version: 0, active_page: "gone".into(), pages: vec![] };
        p.normalize();
        assert_eq!(p.active_page, DEFAULT_PAGE_ID);
        assert_eq!(p.version, PROFILE_VERSION);
    }

    #[test]
    fn sound_settings_round_trip() {
        use crate::macros::ActionKind;
        // Legacy lost PlaySound volume/trim and the wait flag on reload (issue #7).
        let mut button = Button::default();
        button.down.push(Action {
            id: "s".into(),
            wait: false,
            kind: ActionKind::PlaySound { file: "a.wav".into(), volume: 0.5, start: 0.1, end: 0.9, output_device: Some("Speakers".into()), volume_from_velocity: true },
        });
        button.hold_ms = 800;
        button.state_link = Some(StateLink { provider: LinkProvider::Obs, kind: LinkKind::Scene, scene: "Game".into(), source: String::new() });
        let json = serde_json::to_string(&button).unwrap();
        let back: Button = serde_json::from_str(&json).unwrap();
        assert_eq!(back, button);
        assert!(!back.down[0].wait);
        // Older profiles without the new fields still load.
        let old: Button = serde_json::from_str(r##"{"look":{"type":"text","caption":"","size":16,"face":"sans","color":"#fff"},"color":{"mode":"palette","index":3}}"##).unwrap();
        assert_eq!(old.hold_ms, 500);
        assert!(old.hold.is_empty() && old.state_link.is_none());
    }

    #[test]
    fn fader_geometry_and_levels() {
        let mut f = Fader { id: "f".into(), x: 2, y: 1, direction: FaderDirection::Up, length: 4, min: -60.0, max: 0.0, ..Fader::default() };
        assert_eq!(f.pads(), vec![(2, 1), (2, 2), (2, 3), (2, 4)]);
        assert_eq!(f.step_of(2, 3), Some(2));
        assert_eq!(f.step_of(3, 3), None);
        assert_eq!(f.value_at_step(0), -60.0);
        assert_eq!(f.value_at_step(3), 0.0);
        f.value = -20.0;
        assert_eq!(f.level_step(), 2);
        assert_eq!(f.color_at(0), f.color_a);
        assert_eq!(f.color_at(3), f.color_b);
        assert_eq!(f.pad_rgb(2), f.color_at(2));
        assert!(f.pad_rgb(3).iter().zip(f.color_b.iter()).all(|(d, c)| *d <= *c));
        // A run towards an edge stops at the grid border.
        let left = Fader { x: 1, y: 0, direction: FaderDirection::Left, length: 4, ..Fader::default() };
        assert_eq!(left.pads(), vec![(1, 0), (0, 0)]);
        let mut page = Page::new("p", "P");
        page.set_fader(f.clone());
        assert_eq!(page.fader_at(2, 4).map(|(_, s)| s), Some(3));
        let old: Page = serde_json::from_str(r#"{"id":"p","name":"P"}"#).unwrap();
        assert!(old.faders.is_empty());
        // A display scale maps the real range linearly.
        let mut shown = Fader { min: -100.0, max: 26.0, value: -37.0, display: Some(FaderDisplay { min: 0.0, max: 100.0, unit: "%".into(), decimals: 0 }), ..Fader::default() };
        assert_eq!(shown.display_text(), "50%");
        shown.value = 26.0;
        assert_eq!(shown.display_text(), "100%");
        // Counting down: the first pad holds the high end, the last pad the low end.
        let mut down = Fader { length: 5, min: 100.0, max: 0.0, value: 100.0, display: Some(FaderDisplay { min: 100.0, max: 0.0, unit: "%".into(), decimals: 0 }), ..Fader::default() };
        assert_eq!(down.value_at_step(0), 100.0);
        assert_eq!(down.value_at_step(4), 0.0);
        assert_eq!(down.level_step(), 0);
        down.value = 25.0;
        assert_eq!(down.level_step(), 3);
        assert_eq!(down.display_text(), "25%");
        // The variable key prefers the explicit name, then the label without spaces, then the id.
        let mut keyed = Fader { id: "abc".into(), name: "Rolladen 1".into(), ..Fader::default() };
        assert_eq!(keyed.variable_key(), "Rolladen_1");
        keyed.variable = " blinds {1} ".into();
        assert_eq!(keyed.variable_key(), "blinds_1");
        keyed.variable.clear();
        keyed.name.clear();
        assert_eq!(keyed.variable_key(), "abc");
        shown.display = None;
        shown.unit = " dB".into();
        assert_eq!(shown.display_text(), "26 dB");
    }
}

