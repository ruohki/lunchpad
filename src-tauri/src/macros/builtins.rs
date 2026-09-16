//! Variables Lunchpad provides to every macro: the press, the page, the
//! clock, the streaming apps, the device and the machine. Actions cannot
//! write them; the UI colours them apart.

use crate::midi::ConnectedDevice;
use crate::obs::ObsState;
use crate::slobs::SlobsState;
use chrono::{Datelike, Local, Timelike};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::OnceLock;

/// Every provided name, in the order the UI lists them. Mirrored by
/// `BUILTIN_VARIABLES` in `src/lib/api.ts`.
pub const NAMES: &[&str] = &[
    "velocity", "velocity01", "pressure", "pressure01", "x", "y", "pageId", "pageName", "caption", "date", "time", "datetime", "timestamp", "weekday", "year", "month", "day", "hour", "minute", "second", "trigger", "heldMs", "random", "obs.scene", "obs.streaming", "obs.recording", "obs.connected", "slobs.scene", "slobs.streaming", "slobs.recording", "slobs.connected", "model", "port", "firmware", "virtual", "appVersion", "os", "hostname", "username", "downloadDir", "configDir",
];

pub fn is_builtin(name: &str) -> bool {
    NAMES.contains(&name)
}

/// What a press looks like to its actions.
#[derive(Debug, Clone)]
pub struct Press {
    pub velocity: u8,
    pub pressure: u8,
    pub x: u8,
    pub y: u8,
    /// The list that runs: `down`, `up`, `hold`, `fader`, `faderTouch` or `faderRelease`.
    pub trigger: &'static str,
    /// How long the pad has been down, final once it was released.
    pub held_ms: u64,
    pub page_id: String,
    pub page_name: String,
    pub caption: String,
}

impl Press {
    /// A stand-in for previews and tests: a full-force press at the origin of the default page.
    pub fn sample() -> Self {
        Press { velocity: 127, pressure: 0, x: 0, y: 0, trigger: "down", held_ms: 0, page_id: "default".into(), page_name: "Default".into(), caption: String::new() }
    }
}

/// What surrounds a run: the streaming apps, the device and the folders.
#[derive(Clone, Default)]
pub struct Env {
    pub obs: Option<ObsState>,
    pub slobs: Option<SlobsState>,
    pub device: Option<ConnectedDevice>,
    pub downloads: Option<PathBuf>,
    pub config_dir: Option<PathBuf>,
}

fn flag(b: bool) -> String {
    (if b { "true" } else { "false" }).into()
}

fn folder(path: &Option<PathBuf>) -> String {
    path.as_ref().map(|p| p.to_string_lossy().into_owned()).unwrap_or_default()
}

/// The computer's name and the account, read once.
fn machine() -> &'static (String, String) {
    static MACHINE: OnceLock<(String, String)> = OnceLock::new();
    MACHINE.get_or_init(|| {
        let host = gethostname::gethostname().to_string_lossy().into_owned();
        let user = std::env::var("USER").or_else(|_| std::env::var("USERNAME")).unwrap_or_default();
        (host, user)
    })
}

/// The provided values that never change while the app runs: the app, the
/// machine and the folders. The interface caches them for descriptions.
pub fn info(env: &Env) -> HashMap<&'static str, String> {
    let (host, user) = machine();
    HashMap::from([
        ("appVersion", env!("CARGO_PKG_VERSION").to_string()),
        ("os", std::env::consts::OS.to_string()),
        ("hostname", host.clone()),
        ("username", user.clone()),
        ("downloadDir", folder(&env.downloads)),
        ("configDir", folder(&env.config_dir)),
    ])
}

/// What the `Lunchpad` object describes to a script: the pages, the active
/// one, the device and the pressed button.
pub fn script_info(profile: &crate::profile::Profile, press: &Press, env: &Env) -> serde_json::Value {
    let page = |p: &crate::profile::Page| serde_json::json!({ "id": p.id, "name": p.name });
    let pages: Vec<serde_json::Value> = profile.pages.iter().map(page).collect();
    let active = profile.pages.iter().find(|p| p.id == profile.active_page).map(page);
    let device = env.device.as_ref().map(|d| serde_json::json!({ "model": d.model_name, "port": d.input_name, "firmware": d.firmware, "virtual": d.is_virtual }));
    serde_json::json!({
        "pages": pages,
        "activePage": active,
        "device": device,
        "button": { "pageId": press.page_id, "x": press.x, "y": press.y, "caption": press.caption },
    })
}

/// The provided variables for a press, the clock and the surroundings read now.
pub fn values(press: &Press, env: &Env) -> HashMap<&'static str, String> {
    let now = Local::now();
    let mut vars: HashMap<&'static str, String> = HashMap::with_capacity(NAMES.len());
    vars.insert("velocity", press.velocity.to_string());
    vars.insert("velocity01", format!("{:.3}", press.velocity as f32 / 127.0));
    vars.insert("pressure", press.pressure.to_string());
    vars.insert("pressure01", format!("{:.3}", press.pressure as f32 / 127.0));
    vars.insert("x", press.x.to_string());
    vars.insert("y", press.y.to_string());
    vars.insert("pageId", press.page_id.clone());
    vars.insert("pageName", press.page_name.clone());
    vars.insert("caption", press.caption.clone());
    vars.insert("date", now.format("%Y-%m-%d").to_string());
    vars.insert("time", now.format("%H:%M").to_string());
    vars.insert("datetime", now.format("%Y-%m-%d %H:%M:%S").to_string());
    vars.insert("timestamp", now.timestamp().to_string());
    vars.insert("weekday", now.format("%A").to_string());
    vars.insert("year", now.year().to_string());
    vars.insert("month", format!("{:02}", now.month()));
    vars.insert("day", format!("{:02}", now.day()));
    vars.insert("hour", format!("{:02}", now.hour()));
    vars.insert("minute", format!("{:02}", now.minute()));
    vars.insert("second", format!("{:02}", now.second()));
    vars.insert("trigger", press.trigger.to_string());
    vars.insert("heldMs", press.held_ms.to_string());
    vars.insert("random", format!("{:.6}", fastrand::f64()));
    let obs = env.obs.as_ref();
    vars.insert("obs.scene", obs.and_then(|s| s.current_scene.clone()).unwrap_or_default());
    vars.insert("obs.streaming", flag(obs.is_some_and(|s| s.streaming)));
    vars.insert("obs.recording", flag(obs.is_some_and(|s| s.recording)));
    vars.insert("obs.connected", flag(obs.is_some_and(|s| s.connected)));
    let slobs = env.slobs.as_ref();
    vars.insert("slobs.scene", slobs.and_then(|s| s.current_scene.clone()).unwrap_or_default());
    vars.insert("slobs.streaming", flag(slobs.is_some_and(|s| s.streaming == "live")));
    vars.insert("slobs.recording", flag(slobs.is_some_and(|s| s.recording == "recording")));
    vars.insert("slobs.connected", flag(slobs.is_some_and(|s| s.connected)));
    let device = env.device.as_ref();
    vars.insert("model", device.map(|d| d.model_name.clone()).unwrap_or_default());
    vars.insert("port", device.map(|d| d.input_name.clone()).unwrap_or_default());
    vars.insert("firmware", device.and_then(|d| d.firmware.clone()).unwrap_or_default());
    vars.insert("virtual", flag(device.is_some_and(|d| d.is_virtual)));
    vars.extend(info(env));
    vars
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_name_has_a_value() {
        let vars = values(&Press::sample(), &Env::default());
        for name in NAMES {
            assert!(vars.contains_key(name), "{name} missing");
        }
        assert_eq!(vars.len(), NAMES.len());
        assert_eq!(vars["velocity01"], "1.000");
        assert_eq!(vars["date"].len(), 10);
        assert_eq!(vars["time"].len(), 5);
        assert_eq!(vars["obs.connected"], "false");
        assert_eq!(vars["trigger"], "down");
        let r: f64 = vars["random"].parse().unwrap();
        assert!((0.0..1.0).contains(&r));
        assert!(is_builtin("date") && is_builtin("obs.scene") && !is_builtin("deaths"));
    }
}
