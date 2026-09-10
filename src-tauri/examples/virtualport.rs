//! Creates a virtual MIDI in/out pair for N seconds to exercise hot-plug detection
//! without unplugging hardware (macOS/Linux): `cargo run --example virtualport -- 12`
#[cfg(unix)]
use midir::os::unix::{VirtualInput, VirtualOutput};
#[cfg(unix)]
use midir::{MidiInput, MidiOutput};
#[cfg(unix)]
use std::time::Duration;

/// Virtual ports need CoreMIDI or ALSA; Windows MIDI has no equivalent.
#[cfg(not(unix))]
fn main() {
    eprintln!("virtual MIDI ports are not available on this platform");
}

#[cfg(unix)]
fn main() {
    let secs: u64 = std::env::args().nth(1).and_then(|s| s.parse().ok()).unwrap_or(10);
    let name = std::env::args().nth(2).unwrap_or_else(|| "Virtual Test Port".into());
    let out = MidiOutput::new("vp").unwrap();
    let _vo = out.create_virtual(&name).expect("virtual output");
    let inp = MidiInput::new("vp").unwrap();
    let _vi = inp.create_virtual(&name, |_t, msg, _| {
        eprintln!("virtual port received: {:02X?}", msg);
    }, ()).expect("virtual input");
    println!("virtual port '{}' up for {}s", name, secs);
    std::thread::sleep(Duration::from_secs(secs));
    println!("virtual port down");
}
