//! Read-only check of the per-device volume and mute controls: lists every
//! output and input device with its volume and mute state, so the CoreAudio,
//! Windows or PulseAudio code can be checked against real hardware without
//! changing anything. `cargo run --example devicevolume`
use lunchpad_lib::audio_devices;
use lunchpad_lib::macros::SystemVolumeTarget;

#[tokio::main]
async fn main() {
    for target in [SystemVolumeTarget::Output, SystemVolumeTarget::Input] {
        println!("== {target:?} ==");
        let names = match audio_devices::list(target).await {
            Ok(n) => n,
            Err(e) => {
                println!("  cannot list devices: {e}");
                continue;
            }
        };
        for name in names {
            let volume = audio_devices::get_volume(target, &name).await.map(|v| format!("{v:.0} %")).unwrap_or_else(|e| format!("volume: {e}"));
            let muted = audio_devices::get_muted(target, &name).await.map(|m| if m { "muted" } else { "not muted" }.to_string()).unwrap_or_else(|e| format!("mute: {e}"));
            println!("  {name}: {volume}, {muted}");
        }
    }
}
