//! Lists the system's output and input devices and re-selects the current
//! default output through the same call the action uses.
//! `cargo run --example audiodevices [device name]`
use lunchpad_lib::audio_devices;
use lunchpad_lib::macros::SystemVolumeTarget;

#[tokio::main]
async fn main() {
    let outputs = audio_devices::list(SystemVolumeTarget::Output).await.expect("outputs");
    let inputs = audio_devices::list(SystemVolumeTarget::Input).await.expect("inputs");
    println!("outputs: {outputs:?}\ninputs: {inputs:?}");
    if let Some(name) = std::env::args().nth(1) {
        println!("set default output to {name}: {:?}", audio_devices::set_default(SystemVolumeTarget::Output, &name).await);
    }
}
