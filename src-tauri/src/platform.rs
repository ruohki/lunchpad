//! What this system lets Lunchpad do. Most features work everywhere; a few
//! depend on the operating system or, on Linux, on the display server:
//!
//! - A Wayland session does not let one program type into, click into or read
//!   the pointer of another, and it decides window stacking itself, so keys,
//!   text, the mouse, push-to-talk and "stay on top" are unavailable there.
//! - Window control (finding, moving, sizing other programs' windows and
//!   listing the displays) is built for macOS and Windows only.
//!
//! The UI leaves what is missing out of its menus and greys out the settings;
//! the engine refuses it, so a profile made on another system runs the rest.
//!
//! Updates, too: the plain Linux binary is no package the updater can replace,
//! so it sends people to the release page instead of installing.

use serde::Serialize;
use std::sync::OnceLock;

/// Why a feature is missing.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Missing {
    /// The Wayland session does not allow it.
    Wayland,
    /// Lunchpad has no implementation for this operating system.
    System,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Platform {
    /// `macos`, `windows` or `linux` (Rust's `std::env::consts::OS`).
    pub os: &'static str,
    /// On Linux the display server: `wayland` or `x11`; `None` elsewhere or when unknown.
    pub session: Option<&'static str>,
    /// Keys, text and the mouse sent to other programs, the pointer's
    /// position, push-to-talk. `None` = available.
    pub input: Option<Missing>,
    /// Other programs' windows and the displays (get/set window, get screen).
    pub windows: Option<Missing>,
    /// Keeping Lunchpad's own windows above the others.
    pub stay_on_top: Option<Missing>,
    /// Installs new versions itself. False for the plain Linux binary: the
    /// updater can only swap a .deb, an .rpm or an AppImage.
    pub self_update: bool,
}

impl Platform {
    pub fn input_available(&self) -> bool {
        self.input.is_none()
    }
    pub fn stay_on_top_available(&self) -> bool {
        self.stay_on_top.is_none()
    }
}

/// The running system, read once.
pub fn current() -> &'static Platform {
    static PLATFORM: OnceLock<Platform> = OnceLock::new();
    PLATFORM.get_or_init(|| {
        let packaged = tauri::utils::platform::bundle_type().is_some();
        let platform = detect(std::env::consts::OS, packaged, |name| std::env::var(name).ok());
        tracing::info!(?platform, "platform");
        platform
    })
}

/// A Wayland session is recognised by its socket or the session type; a
/// program forced onto XWayland (`GDK_BACKEND=x11`) still lives in one.
fn session(var: &impl Fn(&str) -> Option<String>) -> Option<&'static str> {
    let set = |name: &str| var(name).is_some_and(|v| !v.trim().is_empty());
    let kind = var("XDG_SESSION_TYPE").map(|v| v.trim().to_ascii_lowercase());
    if set("WAYLAND_DISPLAY") || kind.as_deref() == Some("wayland") {
        Some("wayland")
    } else if set("DISPLAY") || kind.as_deref() == Some("x11") {
        Some("x11")
    } else {
        None
    }
}

/// `packaged`: the bundler marked this binary as part of a package (always so
/// on macOS, for the installer on Windows, a .deb or .rpm on Linux).
fn detect(os: &'static str, packaged: bool, var: impl Fn(&str) -> Option<String>) -> Platform {
    let session = if os == "linux" { session(&var) } else { None };
    let wayland = session == Some("wayland");
    let wayland_blocks = wayland.then_some(Missing::Wayland);
    Platform {
        os,
        session,
        input: wayland_blocks,
        windows: match os {
            "macos" | "windows" => None,
            _ => Some(if wayland { Missing::Wayland } else { Missing::System }),
        },
        stay_on_top: wayland_blocks,
        self_update: os != "linux" || packaged,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn env(pairs: &[(&str, &str)]) -> impl Fn(&str) -> Option<String> {
        let map: HashMap<String, String> = pairs.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect();
        move |name| map.get(name).cloned()
    }

    #[test]
    fn macos_and_windows_have_everything() {
        for os in ["macos", "windows"] {
            let p = detect(os, true, env(&[("WAYLAND_DISPLAY", "wayland-0")]));
            assert_eq!(p.session, None);
            assert_eq!((p.input, p.windows, p.stay_on_top), (None, None, None), "{os}");
        }
    }

    #[test]
    fn wayland_session_blocks_input_windows_and_stay_on_top() {
        let p = detect("linux", true, env(&[("XDG_SESSION_TYPE", "wayland"), ("WAYLAND_DISPLAY", "wayland-0"), ("DISPLAY", ":0")]));
        assert_eq!(p.session, Some("wayland"));
        assert_eq!(p.input, Some(Missing::Wayland));
        assert_eq!(p.windows, Some(Missing::Wayland));
        assert_eq!(p.stay_on_top, Some(Missing::Wayland));
    }

    #[test]
    fn wayland_is_found_by_its_socket_alone() {
        // XWayland apps (GDK_BACKEND=x11) see DISPLAY too; the session is still Wayland.
        let p = detect("linux", true, env(&[("WAYLAND_DISPLAY", "wayland-1"), ("DISPLAY", ":1")]));
        assert_eq!(p.session, Some("wayland"));
        assert!(!p.input_available());
    }

    #[test]
    fn x11_session_keeps_input_but_has_no_window_control() {
        let p = detect("linux", true, env(&[("XDG_SESSION_TYPE", "x11"), ("DISPLAY", ":0"), ("WAYLAND_DISPLAY", "")]));
        assert_eq!(p.session, Some("x11"));
        assert!(p.input_available());
        assert!(p.stay_on_top_available());
        assert_eq!(p.windows, Some(Missing::System));
    }

    #[test]
    fn unknown_linux_session_leaves_input_to_the_connection() {
        let p = detect("linux", true, env(&[]));
        assert_eq!(p.session, None);
        assert!(p.input_available());
        assert_eq!(p.windows, Some(Missing::System));
    }

    #[test]
    fn only_the_plain_linux_binary_leaves_updates_to_the_user() {
        assert!(detect("linux", true, env(&[])).self_update);
        assert!(!detect("linux", false, env(&[])).self_update);
        // A Windows build outside the installer (a dev build) keeps its updater, as before.
        assert!(detect("windows", false, env(&[])).self_update);
        assert!(detect("macos", false, env(&[])).self_update);
    }

    #[test]
    fn serializes_for_the_interface() {
        let p = detect("linux", true, env(&[("XDG_SESSION_TYPE", "wayland")]));
        let json = serde_json::to_value(&p).unwrap();
        assert_eq!(json["os"], "linux");
        assert_eq!(json["session"], "wayland");
        assert_eq!(json["input"], "wayland");
        assert_eq!(json["stayOnTop"], "wayland");
        assert_eq!(json["windows"], "wayland");
        assert_eq!(json["selfUpdate"], true);
    }
}
