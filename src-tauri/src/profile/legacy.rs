//! Importer for the legacy Electron app's configuration.
//!
//! The legacy app stored `layout.config` in the renderer's localStorage as a
//! JSON array of pages (`typescript-json-serializer` output):
//!
//! ```json
//! [{ "name": "default", "id": "default",
//!    "buttons": { "0": { "0": { "look": {"type": 0, "caption": "Hi", "size": 16, "face": "Exo 2", "color": "#fff"},
//!                                "loop": false,
//!                                "color": {"mode": 0, "color": 12},
//!                                "activeColor": {"mode": 3, "color": "#ff0000"},
//!                                "down": [{"type": "DELAY", "id": "…", "wait": true, "delay": 500}],
//!                                "up": [] } } } }]
//! ```
//!
//! A single page object (Settings → Pages → export) is accepted as well.
//! Known legacy bugs are compensated: a bare colour object in an `up` list is a
//! `SET_COLOR` action that lost its wrapper, and PlaySound trim/volume are kept
//! even though the legacy loader dropped them.

use super::model::*;
use crate::macros::{Action, ActionKind, KeyEvent, Keystroke, ObsMode, ObsTarget, VarScope, VolumeUnit};
use serde::Serialize;
use serde_json::Value;

#[derive(Debug, Default, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportReport {
    pub pages: usize,
    pub buttons: usize,
    pub actions: usize,
    pub warnings: Vec<String>,
}

pub fn import_legacy(json: &str) -> Result<(Vec<Page>, ImportReport), String> {
    let value: Value = serde_json::from_str(json).map_err(|e| format!("not valid JSON: {e}"))?;
    let mut report = ImportReport::default();
    let raw_pages: Vec<&Value> = match &value {
        Value::Array(items) => items.iter().collect(),
        Value::Object(obj) if obj.contains_key("buttons") => vec![&value],
        _ => return Err("expected a legacy page list or a single page".into()),
    };

    let mut pages = Vec::new();
    for (i, raw) in raw_pages.iter().enumerate() {
        let name = raw.get("name").and_then(Value::as_str).unwrap_or("Imported").to_string();
        let id = raw
            .get("id")
            .and_then(Value::as_str)
            .map(str::to_string)
            .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
        let mut page = Page::new(id, name);
        if let Some(Value::Object(columns)) = raw.get("buttons") {
            for (xs, column) in columns {
                let Ok(x) = xs.parse::<u8>() else { continue };
                let Value::Object(rows) = column else { continue };
                for (ys, raw_button) in rows {
                    let Ok(y) = ys.parse::<u8>() else { continue };
                    match import_button(raw_button, &mut report) {
                        Some(button) => {
                            report.buttons += 1;
                            page.set(x, y, button);
                        }
                        None => report.warnings.push(format!("page {}: button at ({x}, {y}) skipped", i + 1)),
                    }
                }
            }
        }
        report.pages += 1;
        pages.push(page);
    }
    Ok((pages, report))
}

fn import_button(raw: &Value, report: &mut ImportReport) -> Option<Button> {
    let look = raw.get("look").and_then(import_look).unwrap_or_else(|| Look::Text {
        caption: String::new(),
        size: 16,
        face: "sans".into(),
        color: "#ffffff".into(),
    });
    let color = raw.get("color").and_then(import_color).unwrap_or(PadColor::Rgb { r: 0, g: 0, b: 0 });
    let active_color = raw.get("activeColor").and_then(import_color);
    let loop_down = raw.get("loop").and_then(Value::as_bool).unwrap_or(false);
    let down = import_actions(raw.get("down"), report);
    let up = import_actions(raw.get("up"), report);
    Some(Button { look, color, active_color, loop_down, down, up, ..Button::default() })
}

fn import_look(raw: &Value) -> Option<Look> {
    match raw.get("type").and_then(Value::as_u64) {
        Some(1) => Some(Look::Image { uri: raw.get("uri").and_then(Value::as_str).unwrap_or_default().to_string() }),
        _ => Some(Look::Text {
            caption: raw.get("caption").and_then(Value::as_str).unwrap_or_default().to_string(),
            size: raw.get("size").and_then(Value::as_f64).map(|s| s.round() as u16).unwrap_or(16),
            face: legacy_face(raw.get("face").and_then(Value::as_str).unwrap_or("Exo 2")),
            color: raw.get("color").and_then(Value::as_str).unwrap_or("#ffffff").to_string(),
        }),
    }
}

/// Legacy bundled Google fonts; map them to the font keys the new UI offers.
fn legacy_face(face: &str) -> String {
    match face {
        "Oswald" => "condensed",
        "Noto Serif" => "serif",
        "Roboto" | "Source Sans Pro" | "Exo 2" => "sans",
        other => other,
    }
    .to_string()
}

fn import_color(raw: &Value) -> Option<PadColor> {
    let mode = raw.get("mode").and_then(Value::as_u64)?;
    let index = || raw.get("color").and_then(Value::as_u64).unwrap_or(0).min(127) as u8;
    match mode {
        0 => Some(PadColor::Palette { index: index() }),
        1 => Some(PadColor::Flashing { index: index(), alt: raw.get("alt").and_then(Value::as_u64).unwrap_or(0).min(127) as u8 }),
        2 => Some(PadColor::Pulsing { index: index() }),
        3 => {
            let hex = raw.get("color").and_then(Value::as_str).unwrap_or("#000000");
            let (r, g, b) = parse_hex(hex)?;
            Some(PadColor::Rgb { r, g, b })
        }
        _ => None,
    }
}

fn parse_hex(hex: &str) -> Option<(u8, u8, u8)> {
    let h = hex.trim().trim_start_matches('#');
    let h = match h.len() {
        3 => h.chars().flat_map(|c| [c, c]).collect::<String>(),
        6 => h.to_string(),
        _ => return None,
    };
    let v = u32::from_str_radix(&h, 16).ok()?;
    Some(((v >> 16) as u8, (v >> 8) as u8, v as u8))
}

fn import_actions(raw: Option<&Value>, report: &mut ImportReport) -> Vec<Action> {
    let Some(Value::Array(items)) = raw else { return Vec::new() };
    let mut out = Vec::new();
    for item in items {
        match import_action(item, report) {
            Some(action) => {
                report.actions += 1;
                out.push(action);
            }
            None => {
                let t = item.get("type").and_then(Value::as_str).unwrap_or("?");
                report.warnings.push(format!("action of type {t} skipped"));
            }
        }
    }
    out
}

fn s(raw: &Value, key: &str) -> String {
    raw.get(key).and_then(Value::as_str).unwrap_or_default().to_string()
}
fn f(raw: &Value, key: &str, default: f32) -> f32 {
    raw.get(key).and_then(Value::as_f64).map(|v| v as f32).unwrap_or(default)
}
fn b(raw: &Value, key: &str, default: bool) -> bool {
    raw.get(key).and_then(Value::as_bool).unwrap_or(default)
}

fn import_action(raw: &Value, report: &mut ImportReport) -> Option<Action> {
    // Legacy bug: a SetColor in an `up` list was stored as the bare colour.
    if raw.get("type").is_none() && raw.get("mode").is_some() {
        let color = import_color(raw)?;
        report.warnings.push("restored a release-side Set colour action".into());
        return Some(Action::new(ActionKind::SetColor { color, target: None }));
    }
    let id = raw.get("id").and_then(Value::as_str).map(str::to_string).unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let wait = b(raw, "wait", true);
    let kind = match raw.get("type").and_then(Value::as_str)? {
        "PLAY_SOUND" => {
            let device = raw.get("outputDevice").and_then(Value::as_str).unwrap_or("inherit");
            if device != "inherit" && device != "default" {
                report.warnings.push("sound output device reset to the app default (browser device ids do not carry over)".into());
            }
            ActionKind::PlaySound {
                file: file_uri_to_path(&s(raw, "soundfile")),
                volume: f(raw, "volume", 1.0),
                start: f(raw, "start", 0.0),
                end: f(raw, "end", 1.0),
                output_device: None,
                volume_from_velocity: false,
            }
        }
        "TEXT_TO_SPEECH" => ActionKind::TextToSpeech {
            text: s(raw, "text"),
            voice: raw.get("voice").and_then(Value::as_str).filter(|v| !v.is_empty()).map(str::to_string),
            volume: f(raw, "volume", 1.0),
        },
        "LAUNCH_SHELL" => ActionKind::LaunchApplication {
            executable: s(raw, "executable"),
            arguments: s(raw, "arguments"),
            hidden: b(raw, "hidden", false),
            kill_on_stop: b(raw, "killOnStop", true),
            save_output_to: None,
            save_scope: VarScope::Local,
        },
        "HOTKEY" => ActionKind::Hotkey {
            keystrokes: raw
                .get("keystrokes")
                .and_then(Value::as_array)
                .map(|items| items.iter().filter_map(import_keystroke).collect())
                .unwrap_or_default(),
            restore_all_at_end: b(raw, "restoreAllAtEnd", true),
        },
        "DELAY" => ActionKind::Delay { ms: raw.get("delay").and_then(Value::as_f64).unwrap_or(1000.0).max(0.0) as u64 },
        "SWITCH_PAGE" => ActionKind::SwitchPage { page_id: s(raw, "pageId") },
        "SET_COLOR" => ActionKind::SetColor {
            color: raw.get("color").and_then(import_color).unwrap_or(PadColor::Palette { index: 12 }),
            target: None,
        },
        "STOP_ALL_MACROS" => ActionKind::StopAllMacros,
        "STOP_THIS_MACRO" => ActionKind::StopThisMacro,
        "RESTART_THIS_MACRO" => ActionKind::RestartThisMacro,
        "START_PTT" => ActionKind::PushToTalkStart { end_id: s(raw, "endId") },
        "END_PTT" => ActionKind::PushToTalkEnd { start_id: s(raw, "startId") },
        "FLIP_FLOP_START" => ActionKind::FlipFlopStart { middle_id: s(raw, "middleId"), end_id: s(raw, "endId"), is_a: b(raw, "isA", true) },
        "FLIP_FLOP_MIDDLE" => ActionKind::FlipFlopMiddle { start_id: s(raw, "startId"), end_id: s(raw, "endId") },
        "FLIP_FLOP_END" => ActionKind::FlipFlopEnd { start_id: s(raw, "startId"), middle_id: s(raw, "middleId") },
        "OBS_SCENE" => ActionKind::ObsSwitchScene { scene: s(raw, "sceneName"), collection: s(raw, "collectionName") },
        "OBS_TOGGLE_SOURCE" => ActionKind::ObsToggleSource {
            scene: s(raw, "sceneName"),
            collection: s(raw, "collectionName"),
            source: s(raw, "sourceName"),
            visible: b(raw, "visible", true), mode: None },
        "OBS_TOGGLE_MIXER" => ActionKind::ObsSetAudio {
            scene: s(raw, "sceneName"),
            collection: s(raw, "collectionName"),
            source: s(raw, "sourceName"),
            muted: b(raw, "muted", false),
            volume_db: f(raw, "volume", 0.0), volume_from: None, volume_unit: VolumeUnit::Db, mute_mode: None, set_volume: true },
        "OBS_TOGGLE_FILTER" => ActionKind::ObsToggleFilter { source: s(raw, "sourceName"), filter: s(raw, "filterName"), enabled: b(raw, "toggle", true) },
        "OBS_TOGGLE_STREAM" => ActionKind::ObsStream {
            target: match s(raw, "target").as_str() {
                "RECORD" => ObsTarget::Record,
                "REPLAY" => ObsTarget::Replay,
                _ => ObsTarget::Stream,
            },
            mode: match s(raw, "mode").as_str() {
                "STOP" => ObsMode::Stop,
                "TOGGLE" => ObsMode::Toggle,
                _ => ObsMode::Start,
            },
        },
        "OBS_SAVE_REPLAY" => ActionKind::ObsSaveReplay,
        _ => return None,
    };
    Some(Action { id, wait, kind })
}

fn import_keystroke(raw: &Value) -> Option<Keystroke> {
    let event = |e: KeyEvent| Keystroke::Key {
        event: e,
        key: s(raw, "key"),
        modifiers: raw
            .get("modifier")
            .and_then(Value::as_array)
            .map(|m| m.iter().filter_map(Value::as_str).map(str::to_string).collect())
            .unwrap_or_default(),
    };
    Some(match raw.get("type").and_then(Value::as_str)? {
        "SIMPLE_DOWN" => event(KeyEvent::Down),
        "SIMPLE_UP" => event(KeyEvent::Up),
        "SIMPLE_DOWN_UP" => event(KeyEvent::Tap),
        "DELAY" => Keystroke::Delay { ms: raw.get("delay").and_then(Value::as_f64).unwrap_or(0.0).max(0.0) as u64 },
        "STRING" => Keystroke::Text { text: s(raw, "text"), delay_ms: raw.get("delay").and_then(Value::as_f64).unwrap_or(0.0).max(0.0) as u64 },
        _ => return None,
    })
}

/// `file:///Users/me/a%20b.wav` → `/Users/me/a b.wav`; other strings pass through.
fn file_uri_to_path(uri: &str) -> String {
    if let Some(rest) = uri.strip_prefix("file://") {
        let decoded = percent_encoding::percent_decode_str(rest).decode_utf8_lossy().to_string();
        // Windows: file:///C:/x → /C:/x
        if decoded.len() > 3 && decoded.starts_with('/') && decoded.as_bytes()[2] == b':' {
            return decoded[1..].to_string();
        }
        return decoded;
    }
    uri.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r##"[
      {"name":"default","id":"default","buttons":{
        "0":{"0":{"look":{"type":0,"caption":"Hello","size":18,"face":"Oswald","color":"#ffffff"},
                  "loop":true,
                  "color":{"mode":0,"color":12},
                  "activeColor":{"mode":3,"color":"#ff8800"},
                  "down":[
                    {"type":"PLAY_SOUND","id":"a1","wait":true,"soundfile":"file:///Users/me/sounds/air%20horn.mp3","volume":1.5,"start":0.1,"end":0.9,"duration":3.2,"outputDevice":"inherit"},
                    {"type":"DELAY","id":"a2","wait":true,"delay":250},
                    {"type":"HOTKEY","id":"a3","wait":true,"restoreAllAtEnd":true,"keystrokes":[
                      {"id":"k1","type":"SIMPLE_DOWN_UP","event":"KEY_DOWN_UP","key":"f5","modifier":["control"]},
                      {"id":"k2","type":"STRING","text":"gg","delay":20}]},
                    {"type":"FLIP_FLOP_START","id":"f1","wait":true,"middleId":"f2","endId":"f3","isA":false},
                    {"type":"OBS_TOGGLE_STREAM","id":"o1","wait":true,"target":"RECORD","mode":"TOGGLE"},
                    {"type":"WEBREQUEST","id":"w1","wait":true}
                  ],
                  "up":[{"mode":1,"color":5,"alt":21},{"type":"STOP_THIS_MACRO","id":"s1","wait":true}]}},
        "8":{"8":{"look":{"type":1,"uri":"data:image/png;base64,AAAA"},"loop":false,"color":{"mode":2,"color":45},"down":[],"up":[]}}
      }},
      {"name":"Second","id":"7d0e1d2c-1111-2222-3333-444444444444","buttons":{}}
    ]"##;

    #[test]
    fn imports_legacy_pages() {
        let (pages, report) = import_legacy(SAMPLE).unwrap();
        assert_eq!(pages.len(), 2);
        assert_eq!(report.buttons, 2);
        assert_eq!(report.actions, 7);
        assert!(report.warnings.iter().any(|w| w.contains("WEBREQUEST")));
        assert!(report.warnings.iter().any(|w| w.contains("release-side")));

        let b = pages[0].get(0, 0).unwrap();
        assert!(b.loop_down);
        assert_eq!(b.look, Look::Text { caption: "Hello".into(), size: 18, face: "condensed".into(), color: "#ffffff".into() });
        assert_eq!(b.color, PadColor::Palette { index: 12 });
        assert_eq!(b.active_color, Some(PadColor::Rgb { r: 255, g: 136, b: 0 }));
        match &b.down[0].kind {
            ActionKind::PlaySound { file, volume, start, end, .. } => {
                assert_eq!(file, "/Users/me/sounds/air horn.mp3");
                assert_eq!((*volume, *start, *end), (1.5, 0.1, 0.9));
            }
            other => panic!("{other:?}"),
        }
        assert_eq!(b.down[1].kind, ActionKind::Delay { ms: 250 });
        match &b.down[2].kind {
            ActionKind::Hotkey { keystrokes, .. } => {
                assert_eq!(keystrokes[0], Keystroke::Key { event: KeyEvent::Tap, key: "f5".into(), modifiers: vec!["control".into()] });
                assert_eq!(keystrokes[1], Keystroke::Text { text: "gg".into(), delay_ms: 20 });
            }
            other => panic!("{other:?}"),
        }
        assert_eq!(b.down[3].kind, ActionKind::FlipFlopStart { middle_id: "f2".into(), end_id: "f3".into(), is_a: false });
        assert_eq!(b.down[4].kind, ActionKind::ObsStream { target: ObsTarget::Record, mode: ObsMode::Toggle });
        assert_eq!(b.up[0].kind, ActionKind::SetColor { color: PadColor::Flashing { index: 5, alt: 21 }, target: None });
        assert_eq!(b.up[1].kind, ActionKind::StopThisMacro);

        let img = pages[0].get(8, 8).unwrap();
        assert_eq!(img.look, Look::Image { uri: "data:image/png;base64,AAAA".into() });
        assert_eq!(img.color, PadColor::Pulsing { index: 45 });
    }

    #[test]
    fn accepts_single_page() {
        let (pages, _) = import_legacy(r#"{"name":"Solo","id":"x","buttons":{}}"#).unwrap();
        assert_eq!(pages[0].name, "Solo");
    }

    #[test]
    fn windows_file_uri() {
        assert_eq!(file_uri_to_path("file:///C:/Sounds/a%20b.wav"), "C:/Sounds/a b.wav");
        assert_eq!(file_uri_to_path("/plain/path.wav"), "/plain/path.wav");
    }
}
