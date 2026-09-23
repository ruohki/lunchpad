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
fn one_u8() -> u8 {
    1
}

/// Which window a window action means.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub enum WindowTarget {
    /// The window with the focus right now
    Foreground,
    /// By title (and program)
    #[default]
    Title,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub enum WindowOp {
    #[default]
    Focus,
    Minimize,
    Maximize,
    Restore,
    SendToBack,
    Close,
    /// To `x`, `y`, on `screen` when given (a blank coordinate keeps the window's place)
    Move,
    /// To `width` × `height`
    Resize,
    /// Move and resize at once
    Bounds,
    /// On `screen`, or on the window's own screen
    Center,
    /// To `screen`, keeping the window's place on it
    Screen,
}

/// How an OBS hotkey is picked.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub enum ObsHotkeyBy {
    /// By the hotkey's name in OBS
    #[default]
    Name,
    /// By the key combination bound in OBS
    Keys,
}

/// Which screen a get-screen action means.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub enum ScreenPick {
    /// The main display
    #[default]
    Primary,
    /// By its number
    Number,
    /// The one the foreground window is on
    Foreground,
    /// The one under the pointer
    Pointer,
}

/// One step of a mouse sequence. Coordinates and amounts are strings so they take placeholders.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum MouseStep {
    /// Put the pointer at `x`, `y`, or with `relative` move it by that much
    Move {
        #[serde(default)]
        x: String,
        #[serde(default)]
        y: String,
        #[serde(default)]
        relative: bool,
    },
    /// Click `clicks` times (1–5) where the pointer is
    Click {
        #[serde(default)]
        button: crate::input::MouseButton,
        #[serde(default = "one_u8")]
        clicks: u8,
    },
    /// Hold a button down until a release step
    Press {
        #[serde(default)]
        button: crate::input::MouseButton,
    },
    Release {
        #[serde(default)]
        button: crate::input::MouseButton,
    },
    /// Turn the wheel by `amount` notches: positive down (or right)
    Scroll {
        #[serde(default)]
        amount: String,
        #[serde(default)]
        axis: ScrollAxis,
    },
    /// Press a button where the pointer is, move to `x`, `y`, let go
    Drag {
        #[serde(default)]
        x: String,
        #[serde(default)]
        y: String,
        #[serde(default)]
        button: crate::input::MouseButton,
    },
    /// Wait `ms` milliseconds (at most 5000)
    Delay {
        ms: u64,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub enum ScrollAxis {
    #[default]
    Vertical,
    Horizontal,
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
    /// Find another program's window, the one in front or by title, and remember it:
    /// `<name>` = its handle, plus `.title`, `.app`, `.x`, `.y`, `.width` and `.height`.
    #[serde(rename_all = "camelCase")]
    GetWindow {
        #[serde(default)]
        target: WindowTarget,
        #[serde(default)]
        title: String,
        #[serde(default)]
        matching: crate::desktop::TitleMatch,
        #[serde(default)]
        app: String,
        save_to: String,
        #[serde(default)]
        save_scope: VarScope,
    },
    /// Find another program's window and raise, minimize, maximize, restore, lower, close,
    /// move, size or center it.
    #[serde(rename_all = "camelCase")]
    SetWindow {
        #[serde(default)]
        target: WindowTarget,
        #[serde(default)]
        title: String,
        #[serde(default)]
        matching: crate::desktop::TitleMatch,
        #[serde(default)]
        app: String,
        #[serde(default)]
        op: WindowOp,
        #[serde(default)]
        x: String,
        #[serde(default)]
        y: String,
        #[serde(default)]
        width: String,
        #[serde(default)]
        height: String,
        /// 1-based screen number, blank for the window's own; `move`, `bounds` and `center` take it as their frame of reference, `screen` moves there.
        #[serde(default)]
        screen: String,
    },
    /// Mouse steps run in order: move, click, press, release, scroll, drag, wait.
    Mouse {
        #[serde(default)]
        steps: Vec<MouseStep>,
    },
    /// Remember a screen: `<name>` = JSON with number, x, y, width, height, scale, dpi, primary and count (of screens), each also as `<name>.<field>`.
    #[serde(rename_all = "camelCase")]
    GetScreen {
        #[serde(default)]
        pick: ScreenPick,
        /// The 1-based number, for `pick: number` (placeholders)
        #[serde(default)]
        number: String,
        save_to: String,
        #[serde(default)]
        save_scope: VarScope,
    },
    /// Show a window with `text`, placeholders filled in. Each action has its own window; running it again updates the text.
    #[serde(rename_all = "camelCase")]
    Debug {
        #[serde(default)]
        title: String,
        #[serde(default)]
        text: String,
        /// Keep the window above the others
        #[serde(default = "default_true")]
        always_on_top: bool,
    },
    /// Remember where the pointer is: `<name>` = "x,y", plus `.x` and `.y`.
    #[serde(rename_all = "camelCase")]
    MousePosition {
        save_to: String,
        #[serde(default)]
        save_scope: VarScope,
    },
    #[serde(rename_all = "camelCase")]
    Delay {
        ms: u64,
        /// A variable (or `{{template}}`) holding the milliseconds; `ms` when it is missing or not a number.
        #[serde(default)]
        ms_from: Option<String>,
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
    /// Fire an OBS hotkey over the websocket, without giving OBS the focus: by its name
    /// (`OBSBasic.StartStreaming`; `context` names the source for per-source ones such as `libobs.mute`)
    /// or by the key combination bound in OBS (`key` is an OBS key id such as `OBS_KEY_F5`).
    ObsTriggerHotkey {
        #[serde(default)]
        by: ObsHotkeyBy,
        #[serde(default)]
        name: String,
        #[serde(default)]
        context: String,
        #[serde(default)]
        key: String,
        #[serde(default)]
        shift: bool,
        #[serde(default)]
        control: bool,
        #[serde(default)]
        alt: bool,
        #[serde(default)]
        command: bool,
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
        /// Store the response body in this variable (`<name>.status` gets the
        /// status code, `<name>.file` the saved file, `<name>.cached` whether
        /// the file was reused)
        #[serde(default)]
        save_to: Option<String>,
        #[serde(default)]
        save_scope: VarScope,
        /// What becomes of the response: text only, or a file in the download
        /// folder made from the body, a base64 field or a URL in a field
        #[serde(default)]
        response: HttpResponse,
        /// JSON field (dot path, `data.0.url`) for the field modes; empty = the whole body
        #[serde(default)]
        response_field: String,
        /// File name (placeholders allowed) in the download folder, or an absolute
        /// path; empty = a name derived from the request
        #[serde(default)]
        file_name: String,
        /// Skip the request when a file (or stored text) for the same inputs exists
        #[serde(default)]
        reuse: bool,
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
    /// Loop: the actions up to `LoopTimeout` repeat, with a pause between rounds. `Count`
    /// runs the body once per value from `from` to `to` in steps of `step` (`loop.value`);
    /// `Until` repeats until the check holds, checked before or after each round; `Forever`
    /// repeats until the macro is stopped. When `timeout_ms` has passed, the actions between
    /// `LoopTimeout` and `LoopEnd` run instead. Everything after the end runs either way.
    #[serde(rename_all = "camelCase")]
    LoopStart {
        #[serde(default)]
        mode: LoopMode,
        #[serde(default)]
        variable: String,
        #[serde(default)]
        op: CompareOp,
        #[serde(default)]
        value: String,
        /// `Until` only: where the check runs.
        #[serde(default)]
        check: LoopCheck,
        /// `Count` only: first value, last value and step; placeholders allowed.
        #[serde(default = "default_loop_from")]
        from: String,
        #[serde(default = "default_loop_to")]
        to: String,
        #[serde(default = "default_loop_from")]
        step: String,
        /// Pause between two rounds, in milliseconds (never below `LOOP_MIN_INTERVAL_MS`).
        #[serde(default = "default_loop_interval")]
        interval_ms: u64,
        /// Time limit counted from the first round; 0 = none.
        #[serde(default)]
        timeout_ms: u64,
        timeout_id: String,
        end_id: String,
    },
    #[serde(rename_all = "camelCase")]
    LoopTimeout {
        start_id: String,
        end_id: String,
    },
    #[serde(rename_all = "camelCase")]
    LoopEnd {
        start_id: String,
        timeout_id: String,
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

fn default_loop_interval() -> u64 {
    100
}
fn default_loop_from() -> String {
    "1".into()
}
fn default_loop_to() -> String {
    "10".into()
}

/// What makes a loop go round.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub enum LoopMode {
    /// From a first to a last value, in steps: a counted loop.
    Count,
    /// Until the check holds.
    #[default]
    Until,
    /// Until the macro is stopped (or the time limit hits).
    Forever,
}

/// Where an `Until` loop checks: before a round (the body may never run) or after it
/// (the body runs at least once).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub enum LoopCheck {
    #[default]
    Head,
    Tail,
}

/// The shortest pause between two rounds of a loop: a body without a wait of its own
/// cannot spin the CPU.
pub const LOOP_MIN_INTERVAL_MS: u64 = 10;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub enum CompareOp {
    #[default]
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

/// What an HTTP action does with the response body.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum HttpResponse {
    /// Keep the text in the variable only
    #[default]
    Text,
    /// The body is the file
    File,
    /// A field holds base64 data (a data URL prefix is fine)
    Base64Field,
    /// A field holds a URL to download
    UrlField,
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
        let a = Action { id: "1".into(), wait: false, kind: ActionKind::Delay { ms: 250, ms_from: None } };
        let json = serde_json::to_string(&a).unwrap();
        assert_eq!(json, r#"{"id":"1","wait":false,"type":"delay","ms":250,"msFrom":null}"#);
        let back: Action = serde_json::from_str(&json).unwrap();
        assert_eq!(back, a);
    }

    #[test]
    fn desktop_actions_take_defaults() {
        let g: Action = serde_json::from_str(r#"{"id":"g","type":"getWindow","target":"foreground","saveTo":"front"}"#).unwrap();
        assert_eq!(g.kind, ActionKind::GetWindow { target: WindowTarget::Foreground, title: String::new(), matching: crate::desktop::TitleMatch::Contains, app: String::new(), save_to: "front".into(), save_scope: VarScope::Local });
        let w: Action = serde_json::from_str(r#"{"id":"w","type":"setWindow","title":"OBS"}"#).unwrap();
        match w.kind {
            ActionKind::SetWindow { target, title, matching, app, op, .. } => {
                assert_eq!((target, op, matching), (WindowTarget::Title, WindowOp::Focus, crate::desktop::TitleMatch::Contains));
                assert_eq!((title.as_str(), app.as_str()), ("OBS", ""));
            }
            _ => panic!(),
        }
        let m: Action = serde_json::from_str(r#"{"id":"m","type":"mouse","steps":[{"type":"click","button":"right"},{"type":"move","x":"1","y":"2"},{"type":"delay","ms":50}]}"#).unwrap();
        assert_eq!(
            m.kind,
            ActionKind::Mouse {
                steps: vec![
                    MouseStep::Click { button: crate::input::MouseButton::Right, clicks: 1 },
                    MouseStep::Move { x: "1".into(), y: "2".into(), relative: false },
                    MouseStep::Delay { ms: 50 },
                ]
            }
        );
        let p = Action { id: "p".into(), wait: true, kind: ActionKind::MousePosition { save_to: "at".into(), save_scope: VarScope::Global } };
        let json = serde_json::to_string(&p).unwrap();
        assert_eq!(json, r#"{"id":"p","wait":true,"type":"mousePosition","saveTo":"at","saveScope":"global"}"#);
        assert_eq!(serde_json::from_str::<Action>(&json).unwrap(), p);
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
    fn loop_markers_take_their_defaults() {
        let a: Action = serde_json::from_str(r#"{"id":"l","type":"loopStart","variable":"count","op":"equals","value":"3","timeoutId":"t","endId":"e"}"#).unwrap();
        assert_eq!(
            a.kind,
            ActionKind::LoopStart {
                mode: LoopMode::Until,
                variable: "count".into(),
                op: CompareOp::Equals,
                value: "3".into(),
                check: LoopCheck::Head,
                from: "1".into(),
                to: "10".into(),
                step: "1".into(),
                interval_ms: 100,
                timeout_ms: 0,
                timeout_id: "t".into(),
                end_id: "e".into()
            }
        );
        let json = serde_json::to_value(&a).unwrap();
        assert_eq!(json["mode"], "until");
        assert_eq!(json["check"], "head");
        assert_eq!(json["intervalMs"], 100);
        assert_eq!(json["timeoutMs"], 0);
        let c: Action = serde_json::from_str(r#"{"id":"c","type":"loopStart","mode":"count","from":"0","to":"{{n}}","step":"2","timeoutId":"t","endId":"e"}"#).unwrap();
        match c.kind {
            ActionKind::LoopStart { mode, to, step, .. } => {
                assert_eq!(mode, LoopMode::Count);
                assert_eq!(to, "{{n}}");
                assert_eq!(step, "2");
            }
            other => panic!("{other:?}"),
        }
        let t: Action = serde_json::from_str(r#"{"id":"t","type":"loopTimeout","startId":"l","endId":"e"}"#).unwrap();
        assert_eq!(t.kind, ActionKind::LoopTimeout { start_id: "l".into(), end_id: "e".into() });
        let e: Action = serde_json::from_str(r#"{"id":"e","type":"loopEnd","startId":"l","timeoutId":"t"}"#).unwrap();
        assert_eq!(e.kind, ActionKind::LoopEnd { start_id: "l".into(), timeout_id: "t".into() });
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
    fn http_response_defaults() {
        let a: Action = serde_json::from_str(r#"{"id":"h","type":"httpRequest","method":"get","url":"https://x"}"#).unwrap();
        match a.kind {
            ActionKind::HttpRequest { response, response_field, file_name, reuse, .. } => {
                assert_eq!(response, HttpResponse::Text);
                assert!(response_field.is_empty() && file_name.is_empty() && !reuse);
            }
            _ => panic!(),
        }
        let b: Action = serde_json::from_str(r#"{"id":"h","type":"httpRequest","method":"post","url":"https://x","response":"base64Field","responseField":"audioContent","reuse":true}"#).unwrap();
        match b.kind {
            ActionKind::HttpRequest { response, response_field, reuse, .. } => {
                assert_eq!(response, HttpResponse::Base64Field);
                assert_eq!(response_field, "audioContent");
                assert!(reuse);
            }
            _ => panic!(),
        }
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
