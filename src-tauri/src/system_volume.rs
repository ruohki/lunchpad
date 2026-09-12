//! Volume and mute of the default output (speakers) or input (microphone)
//! device: AppleScript on macOS, Core Audio on Windows, PulseAudio on Linux.

use crate::macros::{SystemVolumeMode, SystemVolumeTarget};

/// Apply one of the modes: set a level, change it by a step, or mute.
pub async fn apply(target: SystemVolumeTarget, mode: SystemVolumeMode, amount: f32, device: Option<&str>) -> Result<(), String> {
    // A named device is controlled directly; without one the system's default device is meant.
    if let Some(name) = device.map(str::trim).filter(|s| !s.is_empty()) {
        use crate::audio_devices as dev;
        return match mode {
            SystemVolumeMode::Set => dev::set_volume(target, name, amount).await,
            SystemVolumeMode::Adjust => {
                let current = dev::get_volume(target, name).await?;
                dev::set_volume(target, name, current + amount).await
            }
            SystemVolumeMode::Mute => dev::set_muted(target, name, true).await,
            SystemVolumeMode::Unmute => dev::set_muted(target, name, false).await,
            SystemVolumeMode::ToggleMute => {
                let muted = dev::get_muted(target, name).await?;
                dev::set_muted(target, name, !muted).await
            }
        };
    }
    match mode {
        SystemVolumeMode::Set => set(target, amount).await,
        SystemVolumeMode::Adjust => {
            let current = get(target).await?;
            set(target, current + amount).await
        }
        SystemVolumeMode::Mute => set_muted(target, true).await,
        SystemVolumeMode::Unmute => set_muted(target, false).await,
        SystemVolumeMode::ToggleMute => {
            let muted = is_muted(target).await?;
            set_muted(target, !muted).await
        }
    }
}

fn clamp_percent(percent: f32) -> f32 {
    if percent.is_finite() {
        percent.clamp(0.0, 100.0)
    } else {
        0.0
    }
}

/// Set the volume in percent (0-100).
pub async fn set(target: SystemVolumeTarget, percent: f32) -> Result<(), String> {
    let percent = clamp_percent(percent);
    #[cfg(target_os = "macos")]
    {
        let script = format!("set volume {} volume {}", mac::what(target), percent.round() as i32);
        mac::run(&script).await.map(|_| ())
    }
    #[cfg(target_os = "windows")]
    {
        tokio::task::spawn_blocking(move || win::set_scalar(target, percent / 100.0)).await.map_err(|e| e.to_string())?
    }
    #[cfg(target_os = "linux")]
    {
        let (verb, device) = linux::names(target, "volume");
        linux::run(&[verb, device, &format!("{}%", percent.round() as i32)]).await.map(|_| ())
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        let _ = (target, percent);
        Err("system volume is not supported on this platform".into())
    }
}

/// Current volume in percent.
pub async fn get(target: SystemVolumeTarget) -> Result<f32, String> {
    #[cfg(target_os = "macos")]
    {
        let out = mac::run(&format!("{} volume of (get volume settings)", mac::what(target))).await?;
        if out.contains("missing value") {
            return Err(mac::NO_CONTROL.to_string());
        }
        parse_percent(&out).ok_or_else(|| format!("unexpected volume answer: {out}"))
    }
    #[cfg(target_os = "windows")]
    {
        tokio::task::spawn_blocking(move || win::get_scalar(target).map(|s| s * 100.0)).await.map_err(|e| e.to_string())?
    }
    #[cfg(target_os = "linux")]
    {
        let (verb, device) = linux::names(target, "get-volume");
        let out = linux::run(&[verb, device]).await?;
        parse_percent(&out).ok_or_else(|| format!("unexpected volume answer: {out}"))
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        let _ = target;
        Err("system volume is not supported on this platform".into())
    }
}

pub async fn set_muted(target: SystemVolumeTarget, muted: bool) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        match target {
            SystemVolumeTarget::Output => mac::run(&format!("set volume output muted {muted}")).await.map(|_| ()),
            // AppleScript has no input mute: park the level at zero and bring it back later.
            SystemVolumeTarget::Input => {
                if muted {
                    let current = get(target).await?;
                    if current > 0.0 {
                        *mac::INPUT_BEFORE_MUTE.lock() = Some(current);
                    }
                    set(target, 0.0).await
                } else {
                    let restore = mac::INPUT_BEFORE_MUTE.lock().take().unwrap_or(75.0);
                    set(target, restore).await
                }
            }
        }
    }
    #[cfg(target_os = "windows")]
    {
        tokio::task::spawn_blocking(move || win::set_mute(target, muted)).await.map_err(|e| e.to_string())?
    }
    #[cfg(target_os = "linux")]
    {
        let (verb, device) = linux::names(target, "mute");
        linux::run(&[verb, device, if muted { "1" } else { "0" }]).await.map(|_| ())
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        let _ = (target, muted);
        Err("system volume is not supported on this platform".into())
    }
}

pub async fn is_muted(target: SystemVolumeTarget) -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        match target {
            SystemVolumeTarget::Output => {
                let out = mac::run("output muted of (get volume settings)").await?;
                if out.contains("missing value") {
                    return Err(mac::NO_CONTROL.to_string());
                }
                Ok(out.trim() == "true")
            }
            SystemVolumeTarget::Input => Ok(get(target).await? <= 0.0),
        }
    }
    #[cfg(target_os = "windows")]
    {
        tokio::task::spawn_blocking(move || win::get_mute(target)).await.map_err(|e| e.to_string())?
    }
    #[cfg(target_os = "linux")]
    {
        let (verb, device) = linux::names(target, "get-mute");
        Ok(linux::run(&[verb, device]).await?.to_lowercase().contains("yes"))
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        let _ = target;
        Err("system volume is not supported on this platform".into())
    }
}

#[cfg_attr(windows, allow(dead_code))]
/// First number in a tool's answer ("53", "Volume: front-left: 34817 /  53% / …").
pub(crate) fn parse_percent(text: &str) -> Option<f32> {
    if let Some(pos) = text.find('%') {
        let head = &text[..pos];
        let digits: String = head.chars().rev().take_while(|c| c.is_ascii_digit() || *c == '.').collect::<String>().chars().rev().collect();
        if let Ok(v) = digits.parse::<f32>() {
            return Some(v);
        }
    }
    let token: String = text.trim().chars().take_while(|c| c.is_ascii_digit() || *c == '.' || *c == '-').collect();
    token.parse::<f32>().ok()
}

#[cfg(target_os = "macos")]
mod mac {
    use super::SystemVolumeTarget;
    use parking_lot::Mutex;

    pub static INPUT_BEFORE_MUTE: Mutex<Option<f32>> = Mutex::new(None);
    /// USB DACs and HDMI outputs often have no software volume; macOS greys its slider out too.
    pub const NO_CONTROL: &str = "the default output device has no volume control (macOS cannot change it either)";

    pub fn what(target: SystemVolumeTarget) -> &'static str {
        match target {
            SystemVolumeTarget::Output => "output",
            SystemVolumeTarget::Input => "input",
        }
    }

    pub async fn run(script: &str) -> Result<String, String> {
        let out = tokio::process::Command::new("osascript").arg("-e").arg(script).output().await.map_err(|e| e.to_string())?;
        if out.status.success() {
            Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
        } else {
            Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
        }
    }
}

#[cfg(target_os = "linux")]
mod linux {
    use super::SystemVolumeTarget;

    /// `pactl` verb and default device for an operation ("volume", "mute", "get-volume", "get-mute").
    pub fn names(target: SystemVolumeTarget, op: &str) -> (&'static str, &'static str) {
        let (kind, device) = match target {
            SystemVolumeTarget::Output => ("sink", "@DEFAULT_SINK@"),
            SystemVolumeTarget::Input => ("source", "@DEFAULT_SOURCE@"),
        };
        let verb: &'static str = match (kind, op) {
            ("sink", "volume") => "set-sink-volume",
            ("sink", "mute") => "set-sink-mute",
            ("sink", "get-volume") => "get-sink-volume",
            ("sink", "get-mute") => "get-sink-mute",
            ("source", "volume") => "set-source-volume",
            ("source", "mute") => "set-source-mute",
            ("source", "get-volume") => "get-source-volume",
            _ => "get-source-mute",
        };
        (verb, device)
    }

    pub async fn run(args: &[&str]) -> Result<String, String> {
        let out = tokio::process::Command::new("pactl").args(args).output().await.map_err(|e| e.to_string())?;
        if out.status.success() {
            Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
        } else {
            Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
        }
    }
}

#[cfg(target_os = "windows")]
mod win {
    use crate::macros::SystemVolumeTarget;
    use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
    use windows::Win32::Media::Audio::{eCapture, eConsole, eRender, IMMDeviceEnumerator, MMDeviceEnumerator};
    use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED};

    fn endpoint(target: SystemVolumeTarget) -> Result<IAudioEndpointVolume, String> {
        // SAFETY: plain COM calls on the default endpoint; handles are dropped with the result.
        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
            let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).map_err(|e| e.to_string())?;
            let flow = match target {
                SystemVolumeTarget::Output => eRender,
                SystemVolumeTarget::Input => eCapture,
            };
            let device = enumerator.GetDefaultAudioEndpoint(flow, eConsole).map_err(|e| e.to_string())?;
            device.Activate(CLSCTX_ALL, None).map_err(|e| e.to_string())
        }
    }

    pub fn set_scalar(target: SystemVolumeTarget, scalar: f32) -> Result<(), String> {
        let volume = endpoint(target)?;
        unsafe { volume.SetMasterVolumeLevelScalar(scalar.clamp(0.0, 1.0), std::ptr::null()).map_err(|e| e.to_string()) }
    }

    pub fn get_scalar(target: SystemVolumeTarget) -> Result<f32, String> {
        let volume = endpoint(target)?;
        unsafe { volume.GetMasterVolumeLevelScalar().map_err(|e| e.to_string()) }
    }

    pub fn set_mute(target: SystemVolumeTarget, muted: bool) -> Result<(), String> {
        let volume = endpoint(target)?;
        unsafe { volume.SetMute(muted, std::ptr::null()).map_err(|e| e.to_string()) }
    }

    pub fn get_mute(target: SystemVolumeTarget) -> Result<bool, String> {
        let volume = endpoint(target)?;
        unsafe { volume.GetMute().map(|b| b.as_bool()).map_err(|e| e.to_string()) }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_tool_answers() {
        assert_eq!(parse_percent("53"), Some(53.0));
        assert_eq!(parse_percent("Volume: front-left: 34817 /  53% / -16.55 dB,   front-right: 34817 /  53% / -16.55 dB"), Some(53.0));
        assert_eq!(parse_percent("100%"), Some(100.0));
        assert_eq!(parse_percent("nope"), None);
        assert_eq!(clamp_percent(140.0), 100.0);
        assert_eq!(clamp_percent(-3.0), 0.0);
        assert_eq!(clamp_percent(f32::NAN), 0.0);
    }
}
