//! Other programs' windows: listing them, finding one, and raising, moving,
//! sizing, minimizing or closing it. macOS goes through the Accessibility API
//! (the permission the keyboard already needs), Windows through Win32; other
//! systems report that window control is not available.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowInfo {
    /// `window:<id>`, stable while the window exists; what a saved variable holds.
    pub handle: String,
    pub title: String,
    /// The program's name
    pub app: String,
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
    /// 1-based number of the display the window is (mostly) on; 0 when unknown.
    pub screen: u32,
    pub minimized: bool,
}

/// A display, in the same coordinates as the windows.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenInfo {
    /// 1-based; Windows numbers them as its display settings do, macOS puts the main display first and then goes left to right.
    pub number: u32,
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
    /// Pixels per point: 2 on a Retina display, 1.5 at 150 % on Windows.
    pub scale: f64,
    /// Physical pixels per inch, 0 when the system does not say.
    pub dpi: u32,
    pub primary: bool,
}

pub type DesktopResult<T> = Result<T, String>;

/// What can be done to a window.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Op {
    Focus,
    Minimize,
    Maximize,
    Restore,
    SendToBack,
    Close,
    Move { x: i32, y: i32 },
    Resize { width: i32, height: i32 },
    Bounds { x: i32, y: i32, width: i32, height: i32 },
}

/// What a set-window action asks for, with the blanks a user may leave; `resolve` turns it into an `Op` once the screens are known.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Change {
    Focus,
    Minimize,
    Maximize,
    Restore,
    SendToBack,
    Close,
    /// Coordinates relative to `screen` when one is given (a missing coordinate keeps the window's place on its screen), absolute otherwise (a missing one is kept).
    Move { x: Option<i32>, y: Option<i32>, screen: Option<u32> },
    Resize { width: Option<i32>, height: Option<i32> },
    Bounds { x: Option<i32>, y: Option<i32>, width: Option<i32>, height: Option<i32>, screen: Option<u32> },
    /// On the given screen, else on the window's own.
    Center { screen: Option<u32> },
}

/// How a title is compared.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub enum TitleMatch {
    #[default]
    Contains,
    StartsWith,
    Exact,
    Regex,
}

#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "macos")]
use macos as platform;
#[cfg(windows)]
mod win;
#[cfg(windows)]
use win as platform;
#[cfg(not(any(target_os = "macos", windows)))]
mod unsupported;
#[cfg(not(any(target_os = "macos", windows)))]
use unsupported as platform;

pub const HANDLE_PREFIX: &str = "window:";

/// Every window a user could mean: visible, titled, belonging to a regular program.
pub fn list() -> DesktopResult<Vec<WindowInfo>> {
    platform::list()
}

/// The window that has the focus right now.
pub fn foreground() -> DesktopResult<Option<WindowInfo>> {
    platform::foreground()
}

/// A window by the handle a variable holds; `None` when it is gone.
pub fn by_handle(handle: &str) -> DesktopResult<Option<WindowInfo>> {
    platform::by_handle(handle)
}

pub fn perform(window: &WindowInfo, op: Op) -> DesktopResult<()> {
    platform::perform(window, op)
}

/// The displays, numbered the way the interface shows them.
pub fn screens() -> DesktopResult<Vec<ScreenInfo>> {
    platform::screens()
}

/// The screen holding most of a rectangle, else the one nearest its centre.
pub fn screen_of(screens: &[ScreenInfo], x: i32, y: i32, width: i32, height: i32) -> Option<&ScreenInfo> {
    let overlap = |s: &ScreenInfo| -> i64 {
        let w = (x + width).min(s.x + s.width) - x.max(s.x);
        let h = (y + height).min(s.y + s.height) - y.max(s.y);
        if w > 0 && h > 0 { w as i64 * h as i64 } else { 0 }
    };
    if let Some(best) = screens.iter().filter(|s| overlap(s) > 0).max_by_key(|s| overlap(s)) {
        return Some(best);
    }
    let (cx, cy) = (x as i64 + width as i64 / 2, y as i64 + height as i64 / 2);
    screens.iter().min_by_key(|s| {
        let (sx, sy) = (s.x as i64 + s.width as i64 / 2, s.y as i64 + s.height as i64 / 2);
        (cx - sx).pow(2) + (cy - sy).pow(2)
    })
}

/// Turns a request into the plain operation the platform performs, working out screen-relative places.
pub fn resolve(window: &WindowInfo, change: Change, screens: &[ScreenInfo]) -> DesktopResult<Op> {
    let by_number = |n: u32| screens.iter().find(|s| s.number == n).ok_or_else(|| format!("there is no screen {n}"));
    let own = || screen_of(screens, window.x, window.y, window.width, window.height);
    // Where a coordinate lands: on the target screen, keeping the window's offset on its own screen when the coordinate is blank.
    let place = |x: Option<i32>, y: Option<i32>, screen: Option<u32>, width: i32, height: i32| -> DesktopResult<(i32, i32)> {
        let Some(number) = screen else {
            return Ok((x.unwrap_or(window.x), y.unwrap_or(window.y)));
        };
        let target = by_number(number)?;
        let (ox, oy) = own().map(|s| (window.x - s.x, window.y - s.y)).unwrap_or((0, 0));
        let px = target.x + x.unwrap_or(ox);
        let py = target.y + y.unwrap_or(oy);
        // Keep the window on that screen: pull it back in if it hangs over the right or bottom edge.
        let px = px.min(target.x + target.width - width).max(target.x);
        let py = py.min(target.y + target.height - height).max(target.y);
        Ok((px, py))
    };
    Ok(match change {
        Change::Focus => Op::Focus,
        Change::Minimize => Op::Minimize,
        Change::Maximize => Op::Maximize,
        Change::Restore => Op::Restore,
        Change::SendToBack => Op::SendToBack,
        Change::Close => Op::Close,
        Change::Move { x, y, screen } => {
            let (x, y) = place(x, y, screen, window.width, window.height)?;
            Op::Move { x, y }
        }
        Change::Resize { width, height } => Op::Resize { width: width.unwrap_or(window.width).max(1), height: height.unwrap_or(window.height).max(1) },
        Change::Bounds { x, y, width, height, screen } => {
            let (width, height) = (width.unwrap_or(window.width).max(1), height.unwrap_or(window.height).max(1));
            let (x, y) = place(x, y, screen, width, height)?;
            Op::Bounds { x, y, width, height }
        }
        Change::Center { screen } => {
            let target = match screen {
                Some(n) => by_number(n)?,
                None => own().ok_or_else(|| "no screen is known".to_string())?,
            };
            Op::Move { x: target.x + (target.width - window.width) / 2, y: target.y + (target.height - window.height) / 2 }
        }
    })
}

/// The first window whose title matches (case-insensitively), optionally only of the named program.
pub fn find<'a>(
    windows: &'a [WindowInfo],
    title: &str,
    matching: TitleMatch,
    app: &str,
) -> DesktopResult<Option<&'a WindowInfo>> {
    let title = title.trim();
    let app = app.trim().to_lowercase();
    let wanted = title.to_lowercase();
    let regex = if matching == TitleMatch::Regex {
        Some(
            regex::RegexBuilder::new(title)
                .case_insensitive(true)
                .build()
                .map_err(|e| format!("bad window title pattern: {e}"))?,
        )
    } else {
        None
    };
    Ok(windows.iter().find(|w| {
        if !app.is_empty() && !w.app.to_lowercase().contains(&app) {
            return false;
        }
        let have = w.title.to_lowercase();
        match matching {
            TitleMatch::Contains => have.contains(&wanted),
            TitleMatch::StartsWith => have.starts_with(&wanted),
            TitleMatch::Exact => have == wanted,
            TitleMatch::Regex => regex.as_ref().is_some_and(|r| r.is_match(&w.title)),
        }
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn w(title: &str, app: &str) -> WindowInfo {
        WindowInfo { handle: format!("window:{title}"), title: title.into(), app: app.into(), x: 0, y: 0, width: 100, height: 100, screen: 1, minimized: false }
    }

    fn screens() -> Vec<ScreenInfo> {
        vec![
            ScreenInfo { number: 1, x: 0, y: 0, width: 1920, height: 1080, scale: 1.0, dpi: 96, primary: true },
            ScreenInfo { number: 2, x: 1920, y: -200, width: 2560, height: 1440, scale: 1.0, dpi: 109, primary: false },
        ]
    }

    #[test]
    fn screen_of_a_rectangle() {
        let s = screens();
        assert_eq!(screen_of(&s, 100, 100, 800, 600).map(|s| s.number), Some(1));
        assert_eq!(screen_of(&s, 1800, 0, 800, 600).map(|s| s.number), Some(2));
        assert_eq!(screen_of(&s, 9000, 9000, 10, 10).map(|s| s.number), Some(2));
        assert_eq!(screen_of(&[], 0, 0, 10, 10), None);
    }

    #[test]
    fn resolves_screen_relative_places() {
        let s = screens();
        let win = WindowInfo { x: 300, y: 200, width: 800, height: 600, ..w("t", "a") };
        assert_eq!(resolve(&win, Change::Move { x: Some(10), y: None, screen: None }, &s).unwrap(), Op::Move { x: 10, y: 200 });
        // Keeps the window's offset on its own screen when it changes screens.
        assert_eq!(resolve(&win, Change::Move { x: None, y: None, screen: Some(2) }, &s).unwrap(), Op::Move { x: 2220, y: 0 });
        assert_eq!(resolve(&win, Change::Move { x: Some(0), y: Some(0), screen: Some(2) }, &s).unwrap(), Op::Move { x: 1920, y: -200 });
        // Pulled back onto the screen when it would hang over the edge.
        assert_eq!(resolve(&win, Change::Bounds { x: Some(4000), y: Some(0), width: Some(1000), height: None, screen: Some(2) }, &s).unwrap(), Op::Bounds { x: 3480, y: -200, width: 1000, height: 600 });
        assert_eq!(resolve(&win, Change::Center { screen: None }, &s).unwrap(), Op::Move { x: 560, y: 240 });
        assert_eq!(resolve(&win, Change::Center { screen: Some(2) }, &s).unwrap(), Op::Move { x: 2800, y: 220 });
        assert!(resolve(&win, Change::Move { x: None, y: None, screen: Some(3) }, &s).is_err());
    }

    #[test]
    fn finds_by_title_and_app() {
        let list = vec![
            w("OBS 30.1 - Profile: Default", "OBS Studio"),
            w("Untitled - Notepad", "Notepad"),
            w("Stream chat", "Chrome"),
        ];
        assert_eq!(
            find(&list, "notepad", TitleMatch::Contains, "")
                .unwrap()
                .map(|x| x.app.as_str()),
            Some("Notepad")
        );
        assert_eq!(
            find(&list, "obs", TitleMatch::StartsWith, "")
                .unwrap()
                .map(|x| x.app.as_str()),
            Some("OBS Studio")
        );
        assert!(find(&list, "obs", TitleMatch::Exact, "").unwrap().is_none());
        assert_eq!(
            find(&list, "chat", TitleMatch::Contains, "chrome")
                .unwrap()
                .map(|x| x.title.as_str()),
            Some("Stream chat")
        );
        assert!(find(&list, "chat", TitleMatch::Contains, "notepad")
            .unwrap()
            .is_none());
        assert_eq!(
            find(&list, r"^obs \d+", TitleMatch::Regex, "")
                .unwrap()
                .map(|x| x.app.as_str()),
            Some("OBS Studio")
        );
        assert!(find(&list, "(", TitleMatch::Regex, "").is_err());
    }
}
