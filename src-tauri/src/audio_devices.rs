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

/// Volume in percent of the device called `name` (not necessarily the default one).
pub async fn get_volume(target: SystemVolumeTarget, name: &str) -> Result<f32, String> {
    let wanted = name.trim().to_string();
    #[cfg(target_os = "macos")]
    {
        tokio::task::spawn_blocking(move || {
            let id = mac::find(target, &wanted)?;
            mac::get_volume(id, target).map(|v| v * 100.0)
        })
        .await
        .map_err(|e| e.to_string())?
    }
    #[cfg(target_os = "windows")]
    {
        tokio::task::spawn_blocking(move || win::endpoint_volume(target, &wanted).and_then(|v| unsafe { v.GetMasterVolumeLevelScalar().map(|s| s * 100.0).map_err(|e| e.to_string()) })).await.map_err(|e| e.to_string())?
    }
    #[cfg(target_os = "linux")]
    {
        let id = linux::find(target, &wanted).await?;
        let out = linux::pactl(&[if target == SystemVolumeTarget::Output { "get-sink-volume" } else { "get-source-volume" }, &id]).await?;
        crate::system_volume::parse_percent(&out).ok_or_else(|| format!("could not read the volume: {out}"))
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        let _ = (target, wanted);
        Err("audio devices are not supported on this platform".into())
    }
}

/// Set the volume in percent of the device called `name`.
pub async fn set_volume(target: SystemVolumeTarget, name: &str, percent: f32) -> Result<(), String> {
    let wanted = name.trim().to_string();
    let percent = if percent.is_finite() { percent.clamp(0.0, 100.0) } else { 0.0 };
    #[cfg(target_os = "macos")]
    {
        tokio::task::spawn_blocking(move || {
            let id = mac::find(target, &wanted)?;
            mac::set_volume(id, target, percent / 100.0)
        })
        .await
        .map_err(|e| e.to_string())?
    }
    #[cfg(target_os = "windows")]
    {
        tokio::task::spawn_blocking(move || win::endpoint_volume(target, &wanted).and_then(|v| unsafe { v.SetMasterVolumeLevelScalar(percent / 100.0, std::ptr::null()).map_err(|e| e.to_string()) })).await.map_err(|e| e.to_string())?
    }
    #[cfg(target_os = "linux")]
    {
        let id = linux::find(target, &wanted).await?;
        linux::pactl(&[if target == SystemVolumeTarget::Output { "set-sink-volume" } else { "set-source-volume" }, &id, &format!("{}%", percent.round() as i32)]).await.map(|_| ())
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        let _ = (target, wanted, percent);
        Err("audio devices are not supported on this platform".into())
    }
}

/// Whether the device called `name` is muted.
pub async fn get_muted(target: SystemVolumeTarget, name: &str) -> Result<bool, String> {
    let wanted = name.trim().to_string();
    #[cfg(target_os = "macos")]
    {
        tokio::task::spawn_blocking(move || {
            let id = mac::find(target, &wanted)?;
            mac::get_muted(id, target)
        })
        .await
        .map_err(|e| e.to_string())?
    }
    #[cfg(target_os = "windows")]
    {
        tokio::task::spawn_blocking(move || win::endpoint_volume(target, &wanted).and_then(|v| unsafe { v.GetMute().map(|b| b.as_bool()).map_err(|e| e.to_string()) })).await.map_err(|e| e.to_string())?
    }
    #[cfg(target_os = "linux")]
    {
        let id = linux::find(target, &wanted).await?;
        Ok(linux::pactl(&[if target == SystemVolumeTarget::Output { "get-sink-mute" } else { "get-source-mute" }, &id]).await?.to_lowercase().contains("yes"))
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        let _ = (target, wanted);
        Err("audio devices are not supported on this platform".into())
    }
}

/// Mute or unmute the device called `name`.
pub async fn set_muted(target: SystemVolumeTarget, name: &str, muted: bool) -> Result<(), String> {
    let wanted = name.trim().to_string();
    #[cfg(target_os = "macos")]
    {
        tokio::task::spawn_blocking(move || {
            let id = mac::find(target, &wanted)?;
            mac::set_muted(id, target, muted)
        })
        .await
        .map_err(|e| e.to_string())?
    }
    #[cfg(target_os = "windows")]
    {
        tokio::task::spawn_blocking(move || win::endpoint_volume(target, &wanted).and_then(|v| unsafe { v.SetMute(muted, std::ptr::null()).map_err(|e| e.to_string()) })).await.map_err(|e| e.to_string())?
    }
    #[cfg(target_os = "linux")]
    {
        let id = linux::find(target, &wanted).await?;
        linux::pactl(&[if target == SystemVolumeTarget::Output { "set-sink-mute" } else { "set-source-mute" }, &id, if muted { "1" } else { "0" }]).await.map(|_| ())
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        let _ = (target, wanted, muted);
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
        kAudioDevicePropertyMute, kAudioDevicePropertyStreams, kAudioDevicePropertyVolumeScalar, kAudioHardwarePropertyDefaultInputDevice, kAudioHardwarePropertyDefaultOutputDevice,
        kAudioHardwarePropertyDevices, kAudioObjectPropertyElementMain, kAudioObjectPropertyName, kAudioObjectPropertyScopeGlobal, kAudioObjectPropertyScopeInput,
        kAudioObjectPropertyScopeOutput, kAudioObjectSystemObject, AudioObjectGetPropertyData, AudioObjectGetPropertyDataSize, AudioObjectHasProperty, AudioObjectID,
        AudioObjectPropertyAddress, AudioObjectPropertyScope, AudioObjectPropertySelector, AudioObjectSetPropertyData,
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

    /// The device called `name` (see `pick` for how names match).
    pub fn find(target: SystemVolumeTarget, name: &str) -> Result<AudioObjectID, String> {
        let devices = devices(target)?;
        super::pick(&devices, name).map(|(id, _)| *id).ok_or_else(|| format!("no {} device called \"{name}\"", super::kind(target)))
    }

    fn scope_of(target: SystemVolumeTarget) -> AudioObjectPropertyScope {
        match target {
            SystemVolumeTarget::Output => kAudioObjectPropertyScopeOutput,
            SystemVolumeTarget::Input => kAudioObjectPropertyScopeInput,
        }
    }

    /// Elements that carry a property: the main element when the device has one, else the
    /// first two channels (many USB interfaces only expose per-channel controls).
    fn elements_with(id: AudioObjectID, selector: AudioObjectPropertySelector, scope: AudioObjectPropertyScope) -> Vec<u32> {
        let has = |element: u32| {
            let mut addr = AudioObjectPropertyAddress { mSelector: selector, mScope: scope, mElement: element };
            // SAFETY: a plain query with a valid address.
            unsafe { AudioObjectHasProperty(id, NonNull::from(&mut addr)) }
        };
        if has(kAudioObjectPropertyElementMain) {
            vec![kAudioObjectPropertyElementMain]
        } else {
            [1u32, 2].into_iter().filter(|e| has(*e)).collect()
        }
    }

    fn read_u32(id: AudioObjectID, selector: AudioObjectPropertySelector, scope: AudioObjectPropertyScope, element: u32) -> Result<u32, String> {
        let mut addr = AudioObjectPropertyAddress { mSelector: selector, mScope: scope, mElement: element };
        let mut value: u32 = 0;
        let mut size = std::mem::size_of::<u32>() as u32;
        // SAFETY: reads one u32 into `value`.
        let status = unsafe { AudioObjectGetPropertyData(id, NonNull::from(&mut addr), 0, std::ptr::null(), NonNull::from(&mut size), NonNull::new_unchecked(&mut value as *mut _ as *mut c_void)) };
        if status == 0 {
            Ok(value)
        } else {
            Err(format!("CoreAudio error {status}"))
        }
    }

    fn read_f32(id: AudioObjectID, selector: AudioObjectPropertySelector, scope: AudioObjectPropertyScope, element: u32) -> Result<f32, String> {
        let mut addr = AudioObjectPropertyAddress { mSelector: selector, mScope: scope, mElement: element };
        let mut value: f32 = 0.0;
        let mut size = std::mem::size_of::<f32>() as u32;
        // SAFETY: reads one f32 into `value`.
        let status = unsafe { AudioObjectGetPropertyData(id, NonNull::from(&mut addr), 0, std::ptr::null(), NonNull::from(&mut size), NonNull::new_unchecked(&mut value as *mut _ as *mut c_void)) };
        if status == 0 {
            Ok(value)
        } else {
            Err(format!("CoreAudio error {status}"))
        }
    }

    fn write<T: Copy>(id: AudioObjectID, selector: AudioObjectPropertySelector, scope: AudioObjectPropertyScope, element: u32, mut value: T) -> Result<(), String> {
        let mut addr = AudioObjectPropertyAddress { mSelector: selector, mScope: scope, mElement: element };
        // SAFETY: writes one value of the property's type.
        let status = unsafe { AudioObjectSetPropertyData(id, NonNull::from(&mut addr), 0, std::ptr::null(), std::mem::size_of::<T>() as u32, NonNull::new_unchecked(&mut value as *mut _ as *mut c_void)) };
        if status == 0 {
            Ok(())
        } else {
            Err(format!("CoreAudio error {status}"))
        }
    }

    /// Volume 0..1 of a device in the target's direction.
    pub fn get_volume(id: AudioObjectID, target: SystemVolumeTarget) -> Result<f32, String> {
        let scope = scope_of(target);
        let elements = elements_with(id, kAudioDevicePropertyVolumeScalar, scope);
        let first = elements.first().ok_or_else(|| "this device has no volume control".to_string())?;
        read_f32(id, kAudioDevicePropertyVolumeScalar, scope, *first)
    }

    pub fn set_volume(id: AudioObjectID, target: SystemVolumeTarget, scalar: f32) -> Result<(), String> {
        let scope = scope_of(target);
        let elements = elements_with(id, kAudioDevicePropertyVolumeScalar, scope);
        if elements.is_empty() {
            return Err("this device has no volume control".into());
        }
        for element in elements {
            write(id, kAudioDevicePropertyVolumeScalar, scope, element, scalar.clamp(0.0, 1.0))?;
        }
        Ok(())
    }

    /// Muted state; a device without a mute switch counts as muted when its volume is zero.
    pub fn get_muted(id: AudioObjectID, target: SystemVolumeTarget) -> Result<bool, String> {
        let scope = scope_of(target);
        let elements = elements_with(id, kAudioDevicePropertyMute, scope);
        match elements.first() {
            Some(element) => read_u32(id, kAudioDevicePropertyMute, scope, *element).map(|v| v != 0),
            None => get_volume(id, target).map(|v| v <= 0.0),
        }
    }

    /// Mute through the device's own switch, or by parking the volume at zero when it has none.
    pub fn set_muted(id: AudioObjectID, target: SystemVolumeTarget, muted: bool) -> Result<(), String> {
        let scope = scope_of(target);
        let elements = elements_with(id, kAudioDevicePropertyMute, scope);
        if elements.is_empty() {
            let mut parked = PARKED_VOLUME.lock();
            if muted {
                let current = get_volume(id, target)?;
                if current > 0.0 {
                    parked.retain(|(d, _)| *d != id);
                    parked.push((id, current));
                }
                return set_volume(id, target, 0.0);
            }
            let restore = parked.iter().position(|(d, _)| *d == id).map(|i| parked.remove(i).1).unwrap_or(0.75);
            return set_volume(id, target, restore);
        }
        for element in elements {
            write(id, kAudioDevicePropertyMute, scope, element, u32::from(muted))?;
        }
        Ok(())
    }

    /// Volumes remembered while a device without a mute switch is "muted", by device id.
    static PARKED_VOLUME: parking_lot::Mutex<Vec<(AudioObjectID, f32)>> = parking_lot::Mutex::new(Vec::new());

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
    use super::{parse_pactl_list, pick, kind, SystemVolumeTarget};

    /// The technical sink / source name for a device description.
    pub async fn find(target: SystemVolumeTarget, name: &str) -> Result<String, String> {
        let out = pactl(&["list", if target == SystemVolumeTarget::Output { "sinks" } else { "sources" }]).await?;
        let devices = parse_pactl_list(&out);
        pick(&devices, name).map(|(id, _)| id.clone()).ok_or_else(|| format!("no {} device called \"{name}\"", kind(target)))
    }

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

    /// The volume interface of the device called `name`.
    pub fn endpoint_volume(target: SystemVolumeTarget, name: &str) -> Result<windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume, String> {
        let devices = devices(target)?;
        let (id, _) = super::pick(&devices, name).ok_or_else(|| format!("no {} device called \"{name}\"", super::kind(target)))?;
        // SAFETY: COM lookup of an endpoint by the id the enumeration returned.
        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
            let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).map_err(|e| e.to_string())?;
            let device = enumerator.GetDevice(PCWSTR(id.as_ptr())).map_err(|e| e.to_string())?;
            device.Activate(CLSCTX_ALL, None).map_err(|e| e.to_string())
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
