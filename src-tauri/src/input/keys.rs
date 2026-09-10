//! Key vocabulary. Names follow the legacy app (robotjs) so imported hotkeys
//! keep working: letters and digits, `f1`..`f20`, `space`, `enter`, `tab`,
//! `escape`, `backspace`, `delete`, `up`/`down`/`left`/`right`, `home`, `end`,
//! `pageup`, `pagedown`, `capslock`, `numpad_0`..`numpad_9`, `numpad_+` etc.,
//! `audio_*`, and the modifiers `control`, `alt`, `shift`, `command`.

use enigo::{Button, Key};

/// Mouse buttons usable wherever a key is (push-to-talk, hotkey steps).
pub fn parse_mouse(name: &str) -> Option<Button> {
    match name.trim().to_lowercase().as_str() {
        "mouse_left" => Some(Button::Left),
        "mouse_right" => Some(Button::Right),
        "mouse_middle" => Some(Button::Middle),
        "mouse_back" | "mouse_4" => Some(Button::Back),
        "mouse_forward" | "mouse_5" => Some(Button::Forward),
        _ => None,
    }
}

pub fn parse_key(name: &str) -> Option<Key> {
    let n = name.trim().to_lowercase();
    if let Some(m) = parse_modifier(&n) {
        return Some(m);
    }
    let key = match n.as_str() {
        "space" => Key::Space,
        "enter" | "return" => Key::Return,
        "tab" => Key::Tab,
        "escape" | "esc" => Key::Escape,
        "backspace" => Key::Backspace,
        "delete" | "del" => Key::Delete,
        "up" => Key::UpArrow,
        "down" => Key::DownArrow,
        "left" => Key::LeftArrow,
        "right" => Key::RightArrow,
        "home" => Key::Home,
        "end" => Key::End,
        "pageup" => Key::PageUp,
        "pagedown" => Key::PageDown,
        "capslock" => Key::CapsLock,
        "help" | "insert" => Key::Help,
        "audio_mute" => Key::VolumeMute,
        "audio_vol_down" => Key::VolumeDown,
        "audio_vol_up" => Key::VolumeUp,
        "audio_play" | "audio_pause" => Key::MediaPlayPause,
        "audio_next" => Key::MediaNextTrack,
        "audio_prev" => Key::MediaPrevTrack,
        "numpad_0" => Key::Numpad0,
        "numpad_1" => Key::Numpad1,
        "numpad_2" => Key::Numpad2,
        "numpad_3" => Key::Numpad3,
        "numpad_4" => Key::Numpad4,
        "numpad_5" => Key::Numpad5,
        "numpad_6" => Key::Numpad6,
        "numpad_7" => Key::Numpad7,
        "numpad_8" => Key::Numpad8,
        "numpad_9" => Key::Numpad9,
        "numpad_+" => Key::Add,
        "numpad_-" => Key::Subtract,
        "numpad_*" => Key::Multiply,
        "numpad_/" => Key::Divide,
        "numpad_." => Key::Decimal,
        _ => {
            if let Some(num) = n.strip_prefix('f').and_then(|d| d.parse::<u8>().ok()) {
                return function_key(num);
            }
            let mut chars = name.trim().chars();
            match (chars.next(), chars.next()) {
                (Some(c), None) => Key::Unicode(c.to_ascii_lowercase()),
                _ => return None,
            }
        }
    };
    Some(key)
}

pub fn parse_modifier(name: &str) -> Option<Key> {
    Some(match name.trim().to_lowercase().as_str() {
        "control" | "ctrl" | "left_control" => Key::Control,
        "right_control" => Key::RControl,
        "alt" | "option" => Key::Alt,
        "right_alt" => Key::Alt,
        "shift" | "left_shift" => Key::Shift,
        "right_shift" => Key::RShift,
        "command" | "cmd" | "meta" | "super" | "win" | "windows" => Key::Meta,
        _ => return None,
    })
}

fn function_key(n: u8) -> Option<Key> {
    Some(match n {
        1 => Key::F1,
        2 => Key::F2,
        3 => Key::F3,
        4 => Key::F4,
        5 => Key::F5,
        6 => Key::F6,
        7 => Key::F7,
        8 => Key::F8,
        9 => Key::F9,
        10 => Key::F10,
        11 => Key::F11,
        12 => Key::F12,
        13 => Key::F13,
        14 => Key::F14,
        15 => Key::F15,
        16 => Key::F16,
        17 => Key::F17,
        18 => Key::F18,
        19 => Key::F19,
        20 => Key::F20,
        _ => return None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_common_names() {
        assert_eq!(parse_key("f9"), Some(Key::F9));
        assert_eq!(parse_key("a"), Some(Key::Unicode('a')));
        assert_eq!(parse_key("A"), Some(Key::Unicode('a')));
        assert_eq!(parse_key("space"), Some(Key::Space));
        assert_eq!(parse_key("numpad_+"), Some(Key::Add));
        assert_eq!(parse_modifier("command"), Some(Key::Meta));
        assert_eq!(parse_key("f99"), None);
        assert_eq!(parse_key("nonsense"), None);
    }
}
