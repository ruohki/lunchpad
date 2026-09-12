//! Serializable action model. Every action a button can run is a variant of
//! [`ActionKind`]; [`Action`] adds the per-instance id and the `wait` flag
//! (whether the runner waits for the action before starting the next one).
//!
//! JSON shape: `{ "id": "…", "wait": true, "type": "delay", "ms": 500 }`.

use crate::profile::model::PadColor;
pub use crate::homeassistant::{HaPower, HaValueKind};
use serde::{Deserialize, Serialize};

fn default_true() -> bool {
    true
}
fn one() -> f32 {
    1.0
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Action {
    pub id: String,
    /// Wait for this action to finish before running the next one.
    #[serde(default = "default_true")]
    pub wait: bool,
    #[serde(flatten)]
    pub kind: ActionKind,
}

impl Action {
    pub fn new(kind: ActionKind) -> Self {
        Action { id: uuid::Uuid::new_v4().to_string(), wait: true, kind }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ActionKind {
    /// Play an audio file on an output device (`None` = app default device).
    #[serde(rename_all = "camelCase")]
    PlaySound {
        file: String,
        /// 1.0 = 100 %; legacy allowed up to 20.0
        #[serde(default = "one")]
        volume: f32,
        /// Trim start, 0.0..1.0 of the file
        #[serde(default)]
        start: f32,
        /// Trim end, 0.0..1.0 of the file
        #[serde(default = "one")]
        end: f32,
        #[serde(default)]
        output_device: Option<String>,
        /// Scale the volume by the trigger velocity (velocity-sensitive pads)
        #[serde(default)]
        volume_from_velocity: bool,
    },
    #[serde(rename_all = "camelCase")]
    TextToSpeech {
        text: String,
        #[serde(default)]
        voice: Option<String>,
        #[serde(default = "one")]
        volume: f32,
    },
    #[serde(rename_all = "camelCase")]
    LaunchApplication {
        executable: String,
        #[serde(default)]
        arguments: String,
        #[serde(default)]
        hidden: bool,
        #[serde(default = "default_true")]
        kill_on_stop: bool,
        /// Store the program's standard output in this variable (needs `wait`)
        #[serde(default)]
        save_output_to: Option<String>,
        #[serde(default)]
        save_scope: VarScope,
    },
    #[serde(rename_all = "camelCase")]
    Hotkey {
        keystrokes: Vec<Keystroke>,
        #[serde(default = "default_true")]
        restore_all_at_end: bool,
    },
    Delay {
        ms: u64,
    },
    #[serde(rename_all = "camelCase")]
    SwitchPage {
        page_id: String,
    },
    /// Change and persist the colour of a button: this one (no target) or any
    /// other button on any page.
    SetColor {
        color: PadColor,
        #[serde(default)]
        target: Option<ButtonRef>,
    },
    /// Move a fader (by name) to a value, as if its pad had been pressed:
    /// LEDs, `fader.<name>` and, unless `run_actions` is off, its actions.
    #[serde(rename_all = "camelCase")]
    SetFader {
        fader: String,
        /// Number or placeholder, clamped to the fader's range
        value: String,
        #[serde(default = "default_true")]
        run_actions: bool,
    },
    /// Run another button's actions as part of this chain. With `wait` the
    /// runner waits for the other button's macro to finish.
    RunButton {
        target: ButtonRef,
        #[serde(default)]
        trigger: ButtonTrigger,
    },
    StopAllMacros,
    StopThisMacro,
    RestartThisMacro,
    #[serde(rename_all = "camelCase")]
    PushToTalkStart {
        end_id: String,
    },
    #[serde(rename_all = "camelCase")]
    PushToTalkEnd {
        start_id: String,
    },
    /// Actions between Start and Middle run on "A" presses, between Middle and
    /// End on "B" presses; `is_a` alternates and is persisted.
    #[serde(rename_all = "camelCase")]
    FlipFlopStart {
        middle_id: String,
        end_id: String,
        #[serde(default = "default_true")]
        is_a: bool,
    },
    #[serde(rename_all = "camelCase")]
    FlipFlopMiddle {
        start_id: String,
        end_id: String,
    },
    #[serde(rename_all = "camelCase")]
    FlipFlopEnd {
        start_id: String,
        middle_id: String,
    },
    ObsSwitchScene {
        scene: String,
        #[serde(default)]
        collection: String,
    },
    ObsToggleSource {
        scene: String,
        #[serde(default)]
        collection: String,
        source: String,
        visible: bool,
        /// Show / hide / toggle; `None` falls back to `visible`
        #[serde(default)]
        mode: Option<VisibilityMode>,
    },
    #[serde(rename_all = "camelCase")]
    ObsSetAudio {
        scene: String,
        #[serde(default)]
        collection: String,
        source: String,
        muted: bool,
        /// Mute / unmute / toggle / keep; `None` falls back to `muted`
        #[serde(default)]
        mute_mode: Option<MuteMode>,
        /// Volume in `volume_unit` (dB: -100..26, percent: 0..2000 like OBS's advanced audio properties)
        volume_db: f32,
        /// Variable or placeholder that overrides `volume_db` when it holds a number (faders write `value`)
        #[serde(default)]
        volume_from: Option<String>,
        #[serde(default)]
        volume_unit: VolumeUnit,
        /// Whether the volume is applied at all (a pure mute button leaves it alone)
        #[serde(default = "default_true")]
        set_volume: bool,
    },
    ObsToggleFilter {
        source: String,
        filter: String,
        enabled: bool,
    },
    ObsStream {
        target: ObsTarget,
        mode: ObsMode,
    },
    ObsSaveReplay,
    /// Studio mode on/off, or push the preview scene to the program.
    ObsStudioMode {
        mode: StudioMode,
    },
    /// Streamlabs Desktop: the same controls as OBS, by name.
    SlobsSwitchScene {
        scene: String,
        #[serde(default)]
        collection: String,
    },
    SlobsToggleSource {
        scene: String,
        #[serde(default)]
        collection: String,
        source: String,
        visible: bool,
        #[serde(default)]
        mode: Option<VisibilityMode>,
    },
    #[serde(rename_all = "camelCase")]
    SlobsSetAudio {
        scene: String,
        #[serde(default)]
        collection: String,
        source: String,
        muted: bool,
        #[serde(default)]
        mute_mode: Option<MuteMode>,
        /// Volume in `volume_unit`: dB mapped onto the mixer fader, or percent as the fader position
        volume_db: f32,
        #[serde(default)]
        volume_from: Option<String>,
        #[serde(default)]
        volume_unit: VolumeUnit,
        #[serde(default = "default_true")]
        set_volume: bool,
    },
    /// Stop every sound Lunchpad is playing.
    StopAllSounds,
    /// Make a device the system default output (speakers) or input (microphone).
    #[serde(rename_all = "camelCase")]
    SetAudioDevice {
        target: SystemVolumeTarget,
        /// Device name as the system lists it (placeholders allowed)
        device: String,
    },
    /// Add a number to a variable (counters); missing or non-numeric values count as 0.
    #[serde(rename_all = "camelCase")]
    AddToVariable {
        name: String,
        /// Number or placeholder, negative to subtract
        amount: String,
        #[serde(default)]
        scope: VarScope,
    },
    /// Volume or mute of the default output or input device. `volume` is the
    /// level (0-100 %) for `Set`, the step for `Adjust`, unused for the mutes.
    #[serde(rename_all = "camelCase")]
    SetSystemVolume {
        target: SystemVolumeTarget,
        #[serde(default)]
        mode: SystemVolumeMode,
        volume: f32,
        /// Variable or placeholder that overrides `volume` when it holds a number
        #[serde(default)]
        volume_from: Option<String>,
        /// A specific device by name; `None` = the system's default device
        #[serde(default)]
        device: Option<String>,
    },
    SlobsToggleFilter {
        source: String,
        filter: String,
        enabled: bool,
    },
    SlobsStream {
        target: ObsTarget,
        mode: ObsMode,
    },
    SlobsSaveReplay,
    /// Studio mode on/off, or push the preview live.
    SlobsStudioMode {
        mode: StudioMode,
    },
    /// Home Assistant: turn an entity on or off (or toggle it)
    #[serde(rename_all = "camelCase")]
    HomeAssistantTurn {
        entity: String,
        #[serde(default)]
        mode: HaPower,
    },
    /// Home Assistant: set a numeric property, fixed or from a variable / fader
    #[serde(rename_all = "camelCase")]
    HomeAssistantSetValue {
        entity: String,
        #[serde(default)]
        kind: HaValueKind,
        value: f32,
        /// Variable or placeholder that overrides `value` when it holds a number
        #[serde(default)]
        value_from: Option<String>,
    },
    /// Home Assistant: call any service; `data` is JSON and may contain placeholders
    #[serde(rename_all = "camelCase")]
    HomeAssistantCallService {
        domain: String,
        service: String,
        #[serde(default)]
        entity: String,
        #[serde(default)]
        data: String,
    },
    /// Any HTTP call. URL, headers, body and auth may contain `{{velocity}}`,
    /// `{{x}}`, `{{y}}` and `{{pageId}}`.
    #[serde(rename_all = "camelCase")]
    HttpRequest {
        method: HttpMethod,
        url: String,
        #[serde(default)]
        headers: Vec<HttpHeader>,
        /// Content-Type for the body (`None` sends none / lets the mode decide)
        #[serde(default)]
        content_type: Option<String>,
        /// Text body, or `name=value` lines for a multipart form
        #[serde(default)]
        body: String,
        #[serde(default)]
        body_mode: HttpBodyMode,
        /// File whose bytes are sent as the body (`body_mode = File`)
        #[serde(default)]
        body_file: Option<String>,
        /// File parts of a multipart form (`body_mode = Multipart`)
        #[serde(default)]
        files: Vec<HttpFilePart>,
        #[serde(default)]
        auth: HttpAuth,
        #[serde(default = "default_timeout")]
        timeout_ms: u64,
        #[serde(default)]
        ignore_tls_errors: bool,
        /// Store the response body in this variable (`<name>.status` gets the status code)
        #[serde(default)]
        save_to: Option<String>,
        #[serde(default)]
        save_scope: VarScope,
    },
    /// Branch: actions up to `IfElse` run when the condition holds, actions
    /// between `IfElse` and `IfEnd` when it does not.
    #[serde(rename_all = "camelCase")]
    IfStart {
        variable: String,
        op: CompareOp,
        #[serde(default)]
        value: String,
        else_id: String,
        end_id: String,
    },
    #[serde(rename_all = "camelCase")]
    IfElse {
        start_id: String,
        end_id: String,
    },
    #[serde(rename_all = "camelCase")]
    IfEnd {
        start_id: String,
        else_id: String,
    },
    /// Set a variable to a value (placeholders allowed).
    #[serde(rename_all = "camelCase")]
    SetVariable {
        name: String,
        value: String,
        #[serde(default)]
        scope: VarScope,
    },
    /// Run a JavaScript snippet with access to the variables; its result can be
    /// stored in a variable.
    #[serde(rename_all = "camelCase")]
    RunScript {
        code: String,
        #[serde(default)]
        save_to: Option<String>,
        #[serde(default)]
        save_scope: VarScope,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CompareOp {
    Equals,
    NotEquals,
    Contains,
    StartsWith,
    EndsWith,
    GreaterThan,
    LessThan,
    IsEmpty,
    IsNotEmpty,
    /// Regular expression match
    Matches,
}

impl CompareOp {
    /// Compare `left` (the variable) with `right` (the expanded value).
    /// Numbers compare numerically when both sides parse, otherwise as text.
    pub fn test(self, left: &str, right: &str) -> bool {
        let nums = left.trim().parse::<f64>().ok().zip(right.trim().parse::<f64>().ok());
        match self {
            CompareOp::Equals => nums.map(|(a, b)| a == b).unwrap_or(left == right),
            CompareOp::NotEquals => !CompareOp::Equals.test(left, right),
            CompareOp::Contains => left.contains(right),
            CompareOp::StartsWith => left.starts_with(right),
            CompareOp::EndsWith => left.ends_with(right),
            CompareOp::GreaterThan => nums.map(|(a, b)| a > b).unwrap_or(left > right),
            CompareOp::LessThan => nums.map(|(a, b)| a < b).unwrap_or(left < right),
            CompareOp::IsEmpty => left.trim().is_empty(),
            CompareOp::IsNotEmpty => !left.trim().is_empty(),
            CompareOp::Matches => regex::Regex::new(right).map(|re| re.is_match(left)).unwrap_or(false),
        }
    }
}

/// Where a variable lives: `Local` registers belong to one macro run (and the
/// buttons it calls), `Global` variables are shared by every macro.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum VarScope {
    #[default]
    Local,
    Global,
}

fn default_timeout() -> u64 {
    10_000
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum HttpMethod {
    Get,
    Post,
    Put,
    Patch,
    Delete,
    Head,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct HttpHeader {
    pub name: String,
    pub value: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum HttpBodyMode {
    /// `body` text with `content_type`
    #[default]
    Text,
    /// The bytes of `body_file`
    File,
    /// multipart/form-data: `body` lines as text fields, `files` as file parts
    Multipart,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpFilePart {
    /// Form field name, e.g. "file"
    pub field: String,
    pub path: String,
    /// Filename sent to the server; defaults to the file's own name
    #[serde(default)]
    pub filename: Option<String>,
    /// Content type of the part; guessed from the extension when empty
    #[serde(default)]
    pub content_type: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum HttpAuth {
    #[default]
    None,
    Basic {
        username: String,
        password: String,
    },
    Bearer {
        token: String,
    },
}

/// Reference to a button; `page_id: None` means the page of the calling button.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ButtonRef {
    #[serde(default)]
    pub page_id: Option<String>,
    pub x: u8,
    pub y: u8,
}

/// Which list of another button to run.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ButtonTrigger {
    /// The `down` actions
    #[default]
    Press,
    /// The `up` actions
    Release,
    /// `down` then `up`
    Tap,
    /// The long-press (`hold`) actions
    Hold,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Keystroke {
    Key {
        event: KeyEvent,
        key: String,
        #[serde(default)]
        modifiers: Vec<String>,
    },
    Delay {
        ms: u64,
    },
    #[serde(rename_all = "camelCase")]
    Text {
        text: String,
        #[serde(default)]
        delay_ms: u64,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum KeyEvent {
    Down,
    Up,
    Tap,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ObsTarget {
    Stream,
    Record,
    Replay,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ObsMode {
    Start,
    Stop,
    Toggle,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum VisibilityMode {
    Show,
    Hide,
    Toggle,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MuteMode {
    Mute,
    Unmute,
    Toggle,
    /// Leave the mute state alone
    Keep,
}

/// How a volume number is meant: decibels, or percent of the app's own scale.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum VolumeUnit {
    #[default]
    Db,
    Percent,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SystemVolumeMode {
    /// Set the level
    #[default]
    Set,
    /// Change the level by the amount (negative = quieter)
    Adjust,
    Mute,
    Unmute,
    ToggleMute,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SystemVolumeTarget {
    /// Speakers / headphones
    Output,
    /// Microphone
    Input,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum StudioMode {
    Enable,
    Disable,
    Toggle,
    /// Make the preview scene live (studio mode must be on)
    Transition,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn action_json_shape() {
        let a = Action { id: "1".into(), wait: false, kind: ActionKind::Delay { ms: 250 } };
        let json = serde_json::to_string(&a).unwrap();
        assert_eq!(json, r#"{"id":"1","wait":false,"type":"delay","ms":250}"#);
        let back: Action = serde_json::from_str(&json).unwrap();
        assert_eq!(back, a);
    }

    #[test]
    fn cross_button_actions() {
        let a: Action = serde_json::from_str(r#"{"id":"x","type":"setColor","color":{"mode":"palette","index":5},"target":{"x":1,"y":2}}"#).unwrap();
        match a.kind {
            ActionKind::SetColor { target: Some(t), .. } => assert_eq!((t.page_id, t.x, t.y), (None, 1, 2)),
            _ => panic!(),
        }
        let r: Action = serde_json::from_str(r#"{"id":"y","type":"runButton","target":{"pageId":"p2","x":0,"y":0}}"#).unwrap();
        assert_eq!(r.kind, ActionKind::RunButton { target: ButtonRef { page_id: Some("p2".into()), x: 0, y: 0 }, trigger: ButtonTrigger::Press });
    }

    #[test]
    fn compare_ops() {
        assert!(CompareOp::Equals.test("10", "10.0"));
        assert!(!CompareOp::Equals.test("abc", "ABC"));
        assert!(CompareOp::GreaterThan.test("100", "99"));
        assert!(CompareOp::GreaterThan.test("b", "a"));
        assert!(CompareOp::Contains.test("warm (99)", "warm"));
        assert!(CompareOp::IsEmpty.test("  ", ""));
        assert!(CompareOp::Matches.test("scene-12", r"^scene-\d+$"));
        assert!(!CompareOp::Matches.test("x", "["));
    }

    #[test]
    fn streamlabs_actions() {
        let a: Action = serde_json::from_str(r#"{"id":"s","type":"slobsSwitchScene","scene":"Game"}"#).unwrap();
        assert_eq!(a.kind, ActionKind::SlobsSwitchScene { scene: "Game".into(), collection: String::new() });
        let m: Action = serde_json::from_str(r#"{"id":"m","type":"slobsStudioMode","mode":"transition"}"#).unwrap();
        assert_eq!(m.kind, ActionKind::SlobsStudioMode { mode: StudioMode::Transition });
        let s: Action = serde_json::from_str(r#"{"id":"a","type":"slobsSetAudio","scene":"","source":"Mic","muted":true,"volumeDb":-6.5}"#).unwrap();
        assert_eq!(serde_json::to_value(&s).unwrap()["volumeDb"], -6.5);
        let r: Action = serde_json::from_str(r#"{"id":"r","type":"slobsSaveReplay"}"#).unwrap();
        assert_eq!(r.kind, ActionKind::SlobsSaveReplay);
    }

    #[test]
    fn unit_variants_and_defaults() {
        let a: Action = serde_json::from_str(r#"{"id":"x","type":"stopAllMacros"}"#).unwrap();
        assert!(a.wait);
        assert_eq!(a.kind, ActionKind::StopAllMacros);
        let s: Action = serde_json::from_str(r#"{"id":"y","type":"playSound","file":"a.wav"}"#).unwrap();
        match s.kind {
            ActionKind::PlaySound { volume, start, end, output_device, volume_from_velocity, .. } => {
                assert_eq!((volume, start, end), (1.0, 0.0, 1.0));
                assert!(output_device.is_none());
                assert!(!volume_from_velocity);
            }
            _ => panic!(),
        }
    }
}
