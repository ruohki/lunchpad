//! The system's default output / input device: list devices by the name the
//! system shows, and make one the default. CoreAudio on macOS, the audio
//! policy interface on Windows (what the sound settings use), PulseAudio on
//! Linux.

use crate::macros::SystemVolumeTarget;

/// Names of the devices that can play (output) or record (input).
pub async fn list(target: SystemVolumeTarget) -> Result<Vec<String>, String> {
    #[cfg(target_os = "macos")]
    {
        tokio::task::spawn_blocking(move || mac::devices(target).map(|d| d.into_iter().map(|(_, name)| name).collect())).await.map_err(|e| e.to_string())?
    }
    #[cfg(target_os = "windows")]
    {
        tokio::task::spawn_blocking(move || win::devices(target).map(|d| d.into_iter().map(|(_, name)| name).collect())).await.map_err(|e| e.to_string())?
    }
    #[cfg(target_os = "linux")]
    {
        let out = linux::pactl(&["list", if target == SystemVolumeTarget::Output { "sinks" } else { "sources" }]).await?;
        Ok(parse_pactl_list(&out).into_iter().map(|(_, description)| description).collect())
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        let _ = target;
        Err("audio devices are not supported on this platform".into())
    }
}

/// Make the device called `name` the system default for `target`.
pub async fn set_default(target: SystemVolumeTarget, name: &str) -> Result<(), String> {
    let wanted = name.trim().to_string();
    if wanted.is_empty() {
        return Err("no device name".into());
    }
    #[cfg(target_os = "macos")]
    {
        tokio::task::spawn_blocking(move || {
            let devices = mac::devices(target)?;
            let (id, _) = pick(&devices, &wanted).ok_or_else(|| format!("no {} device called \"{wanted}\"", kind(target)))?;
            mac::set_default(target, *id)
        })
        .await
        .map_err(|e| e.to_string())?
    }
    #[cfg(target_os = "windows")]
    {
        tokio::task::spawn_blocking(move || {
            let devices = win::devices(target)?;
            let (id, _) = pick(&devices, &wanted).ok_or_else(|| format!("no {} device called \"{wanted}\"", kind(target)))?;
            win::set_default(id)
        })
        .await
        .map_err(|e| e.to_string())?
    }
    #[cfg(target_os = "linux")]
    {
        let out = linux::pactl(&["list", if target == SystemVolumeTarget::Output { "sinks" } else { "sources" }]).await?;
        let devices = parse_pactl_list(&out);
        let (id, _) = pick(&devices, &wanted).ok_or_else(|| format!("no {} device called \"{wanted}\"", kind(target)))?;
        let verb = if target == SystemVolumeTarget::Output { "set-default-sink" } else { "set-default-source" };
        linux::pactl(&[verb, id]).await.map(|_| ())
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        let _ = (target, wanted);
        Err("audio devices are not supported on this platform".into())
    }
}

fn kind(target: SystemVolumeTarget) -> &'static str {
    match target {
        SystemVolumeTarget::Output => "output",
        SystemVolumeTarget::Input => "input",
    }
}

/// Exact name first, then case-insensitive, then a name that contains the text.
fn pick<'a, T>(devices: &'a [(T, String)], wanted: &str) -> Option<&'a (T, String)> {
    let lower = wanted.to_lowercase();
    devices
        .iter()
        .find(|(_, n)| n == wanted)
        .or_else(|| devices.iter().find(|(_, n)| n.to_lowercase() == lower))
        .or_else(|| devices.iter().find(|(_, n)| n.to_lowercase().contains(&lower)))
}

/// `pactl list sinks` / `sources` → (technical name, description) pairs.
#[allow(dead_code)]
fn parse_pactl_list(text: &str) -> Vec<(String, String)> {
    let mut out = Vec::new();
    let mut name: Option<String> = None;
    for line in text.lines() {
        let line = line.trim();
        if let Some(n) = line.strip_prefix("Name: ") {
            name = Some(n.trim().to_string());
        } else if let Some(d) = line.strip_prefix("Description: ") {
            if let Some(n) = name.take() {
                out.push((n, d.trim().to_string()));
            }
        }
    }
    out
}

#[cfg(target_os = "macos")]
mod mac {
    use super::SystemVolumeTarget;
    use objc2_core_audio::{
        kAudioDevicePropertyStreams, kAudioHardwarePropertyDefaultInputDevice, kAudioHardwarePropertyDefaultOutputDevice, kAudioHardwarePropertyDevices, kAudioObjectPropertyElementMain,
        kAudioObjectPropertyName, kAudioObjectPropertyScopeGlobal, kAudioObjectPropertyScopeInput, kAudioObjectPropertyScopeOutput, kAudioObjectSystemObject, AudioObjectGetPropertyData,
        AudioObjectGetPropertyDataSize, AudioObjectID, AudioObjectPropertyAddress, AudioObjectPropertyScope, AudioObjectPropertySelector, AudioObjectSetPropertyData,
    };
    use objc2_core_foundation::{CFRetained, CFString};
    use std::ffi::c_void;
    use std::ptr::NonNull;

    /// The bindings type this enum constant as i32; CoreAudio takes an object id.
    const SYSTEM: AudioObjectID = kAudioObjectSystemObject as AudioObjectID;

    fn address(selector: AudioObjectPropertySelector, scope: AudioObjectPropertyScope) -> AudioObjectPropertyAddress {
        AudioObjectPropertyAddress { mSelector: selector, mScope: scope, mElement: kAudioObjectPropertyElementMain }
    }

    fn size_of(object: AudioObjectID, mut addr: AudioObjectPropertyAddress) -> Result<u32, String> {
        let mut size: u32 = 0;
        // SAFETY: plain CoreAudio query with a valid address and out pointer.
        let status = unsafe { AudioObjectGetPropertyDataSize(object, NonNull::from(&mut addr), 0, std::ptr::null(), NonNull::from(&mut size)) };
        if status == 0 {
            Ok(size)
        } else {
            Err(format!("CoreAudio error {status}"))
        }
    }

    /// Devices that have streams in the wanted direction, with their names.
    pub fn devices(target: SystemVolumeTarget) -> Result<Vec<(AudioObjectID, String)>, String> {
        let scope = match target {
            SystemVolumeTarget::Output => kAudioObjectPropertyScopeOutput,
            SystemVolumeTarget::Input => kAudioObjectPropertyScopeInput,
        };
        let list_addr = address(kAudioHardwarePropertyDevices, kAudioObjectPropertyScopeGlobal);
        let mut size = size_of(SYSTEM, list_addr)?;
        let count = size as usize / std::mem::size_of::<AudioObjectID>();
        let mut ids: Vec<AudioObjectID> = vec![0; count.max(1)];
        // SAFETY: the buffer holds `size` bytes of device ids.
        let status = unsafe {
            let mut addr = list_addr;
            AudioObjectGetPropertyData(SYSTEM, NonNull::from(&mut addr), 0, std::ptr::null(), NonNull::from(&mut size), NonNull::new_unchecked(ids.as_mut_ptr() as *mut c_void))
        };
        if status != 0 {
            return Err(format!("CoreAudio error {status}"));
        }
        ids.truncate(size as usize / std::mem::size_of::<AudioObjectID>());

        let mut out = Vec::new();
        for id in ids {
            // Only devices with streams in this direction count as output / input devices.
            let streams = size_of(id, address(kAudioDevicePropertyStreams, scope)).unwrap_or(0);
            if streams == 0 {
                continue;
            }
            let mut name_ref: *const CFString = std::ptr::null();
            let mut name_size = std::mem::size_of::<*const CFString>() as u32;
            let mut addr = address(kAudioObjectPropertyName, kAudioObjectPropertyScopeGlobal);
            // SAFETY: CoreAudio writes a retained CFStringRef into `name_ref`; we take ownership of it.
            let status = unsafe { AudioObjectGetPropertyData(id, NonNull::from(&mut addr), 0, std::ptr::null(), NonNull::from(&mut name_size), NonNull::new_unchecked(&mut name_ref as *mut _ as *mut c_void)) };
            if status != 0 || name_ref.is_null() {
                continue;
            }
            let name = unsafe { CFRetained::from_raw(NonNull::new_unchecked(name_ref as *mut CFString)) }.to_string();
            out.push((id, name));
        }
        Ok(out)
    }

    pub fn set_default(target: SystemVolumeTarget, id: AudioObjectID) -> Result<(), String> {
        let selector = match target {
            SystemVolumeTarget::Output => kAudioHardwarePropertyDefaultOutputDevice,
            SystemVolumeTarget::Input => kAudioHardwarePropertyDefaultInputDevice,
        };
        let mut addr = address(selector, kAudioObjectPropertyScopeGlobal);
        let mut id = id;
        // SAFETY: writes one AudioObjectID, which is what this property takes.
        let status = unsafe {
            AudioObjectSetPropertyData(SYSTEM, NonNull::from(&mut addr), 0, std::ptr::null(), std::mem::size_of::<AudioObjectID>() as u32, NonNull::new_unchecked(&mut id as *mut _ as *mut c_void))
        };
        if status == 0 {
            Ok(())
        } else {
            Err(format!("CoreAudio error {status}"))
        }
    }
}

#[cfg(target_os = "linux")]
mod linux {
    pub async fn pactl(args: &[&str]) -> Result<String, String> {
        let out = tokio::process::Command::new("pactl").args(args).output().await.map_err(|e| e.to_string())?;
        if out.status.success() {
            Ok(String::from_utf8_lossy(&out.stdout).to_string())
        } else {
            Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
        }
    }
}

#[cfg(target_os = "windows")]
mod win {
    use crate::macros::SystemVolumeTarget;
    use windows::core::{interface, IUnknown, IUnknown_Vtbl, PCWSTR, GUID, HRESULT};
    use windows::Win32::Devices::FunctionDiscovery::PKEY_Device_FriendlyName;
    use windows::Win32::Media::Audio::{eCapture, eCommunications, eConsole, eMultimedia, eRender, ERole, IMMDeviceEnumerator, MMDeviceEnumerator, DEVICE_STATE_ACTIVE};
    use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED, STGM_READ};

    /// The interface the Windows sound settings use to change the default device.
    #[interface("f8679f50-850a-41cf-9c72-430f290290c8")]
    unsafe trait IPolicyConfig: IUnknown {
        fn get_mix_format(&self) -> HRESULT;
        fn get_device_format(&self) -> HRESULT;
        fn reset_device_format(&self) -> HRESULT;
        fn set_device_format(&self) -> HRESULT;
        fn get_processing_period(&self) -> HRESULT;
        fn set_processing_period(&self) -> HRESULT;
        fn get_share_mode(&self) -> HRESULT;
        fn set_share_mode(&self) -> HRESULT;
        fn get_property_value(&self) -> HRESULT;
        fn set_property_value(&self) -> HRESULT;
        fn set_default_endpoint(&self, device_id: PCWSTR, role: ERole) -> HRESULT;
        fn set_endpoint_visibility(&self) -> HRESULT;
    }

    const CLSID_POLICY_CONFIG: GUID = GUID::from_u128(0x870af99c_171d_4f9e_af0d_e63df40c2bc9);

    pub fn devices(target: SystemVolumeTarget) -> Result<Vec<(Vec<u16>, String)>, String> {
        // SAFETY: standard COM enumeration of audio endpoints.
        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
            let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).map_err(|e| e.to_string())?;
            let flow = match target {
                SystemVolumeTarget::Output => eRender,
                SystemVolumeTarget::Input => eCapture,
            };
            let collection = enumerator.EnumAudioEndpoints(flow, DEVICE_STATE_ACTIVE).map_err(|e| e.to_string())?;
            let count = collection.GetCount().map_err(|e| e.to_string())?;
            let mut out = Vec::new();
            for i in 0..count {
                let device = collection.Item(i).map_err(|e| e.to_string())?;
                let id = device.GetId().map_err(|e| e.to_string())?;
                let mut wide: Vec<u16> = id.as_wide().to_vec();
                wide.push(0);
                let store = device.OpenPropertyStore(STGM_READ).map_err(|e| e.to_string())?;
                let name = store.GetValue(&PKEY_Device_FriendlyName).map(|v| v.to_string()).unwrap_or_default();
                out.push((wide, name));
            }
            Ok(out)
        }
    }

    pub fn set_default(id: &[u16]) -> Result<(), String> {
        // SAFETY: the policy interface takes the endpoint id for each role.
        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
            let policy: IPolicyConfig = CoCreateInstance(&CLSID_POLICY_CONFIG, None, CLSCTX_ALL).map_err(|e| e.to_string())?;
            for role in [eConsole, eMultimedia, eCommunications] {
                policy.set_default_endpoint(PCWSTR(id.as_ptr()), role).ok().map_err(|e| e.to_string())?;
            }
            Ok(())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn picks_devices_leniently() {
        let devices = vec![(1, "MacBook Pro Speakers".to_string()), (2, "Shure MV7".to_string())];
        assert_eq!(pick(&devices, "Shure MV7").map(|d| d.0), Some(2));
        assert_eq!(pick(&devices, "shure mv7").map(|d| d.0), Some(2));
        assert_eq!(pick(&devices, "speakers").map(|d| d.0), Some(1));
        assert!(pick(&devices, "Headphones").is_none());
    }

    #[test]
    fn parses_pactl_lists() {
        let text = "Sink #0\n\tState: RUNNING\n\tName: alsa_output.pci-0000_00_1f.3.analog-stereo\n\tDescription: Built-in Audio Analog Stereo\n\tDriver: module-alsa-card.c\nSink #1\n\tName: bluez_output.AA\n\tDescription: WH-1000XM4\n";
        let list = parse_pactl_list(text);
        assert_eq!(list.len(), 2);
        assert_eq!(list[1].1, "WH-1000XM4");
        assert_eq!(list[0].0, "alsa_output.pci-0000_00_1f.3.analog-stereo");
    }
}
