//! Lists MIDI ports, sends a Universal Device Inquiry to every output and prints replies.
//! Optionally keeps listening for button presses: `cargo run --example midiprobe -- 20`
//! Use this to fill in the hardware checklist in docs/BUTTON_MAPPING.md.
use midir::{MidiInput, MidiOutput, Ignore};
use std::sync::mpsc;
use std::time::Duration;

fn hex(b: &[u8]) -> String { b.iter().map(|x| format!("{:02X}", x)).collect::<Vec<_>>().join(" ") }

fn main() {
    let mut midi_in = MidiInput::new("probe-in").unwrap();
    midi_in.ignore(Ignore::None);
    let midi_out = MidiOutput::new("probe-out").unwrap();
    println!("== INPUT PORTS ==");
    for (i, p) in midi_in.ports().iter().enumerate() { println!("  [{}] {:?}  id={}", i, midi_in.port_name(p).unwrap(), p.id()); }
    println!("== OUTPUT PORTS ==");
    for (i, p) in midi_out.ports().iter().enumerate() { println!("  [{}] {:?}  id={}", i, midi_out.port_name(p).unwrap(), p.id()); }

    // Send device inquiry to every output port; listen on every input port
    let (tx, rx) = mpsc::channel::<(String, Vec<u8>)>();
    let mut in_conns = Vec::new();
    for p in midi_in.ports() {
        let name = midi_in.port_name(&p).unwrap();
        let mut mi = MidiInput::new("probe-in-c").unwrap();
        mi.ignore(Ignore::None);
        let tx = tx.clone();
        let n2 = name.clone();
        match mi.connect(&p, "probe", move |_ts, msg, _| { let _ = tx.send((n2.clone(), msg.to_vec())); }, ()) {
            Ok(c) => in_conns.push(c),
            Err(e) => println!("  ! could not open input {}: {}", name, e),
        }
    }
    let mut out_conns = Vec::new();
    for p in midi_out.ports() {
        let name = midi_out.port_name(&p).unwrap();
        let mo = MidiOutput::new("probe-out-c").unwrap();
        match mo.connect(&p, "probe") {
            Ok(mut c) => { println!("-> sending device inquiry to {:?}", name); c.send(&[0xF0, 0x7E, 0x7F, 0x06, 0x01, 0xF7]).unwrap(); out_conns.push(c); }
            Err(e) => println!("  ! could not open output {}: {}", name, e),
        }
    }
    println!("== RESPONSES (1s) ==");
    let deadline = std::time::Instant::now() + Duration::from_secs(1);
    while let Ok((name, msg)) = rx.recv_timeout(deadline.saturating_duration_since(std::time::Instant::now())) {
        println!("  <- {:?}: {}", name, hex(&msg));
    }
    let listen_secs: u64 = std::env::args().nth(1).and_then(|s| s.parse().ok()).unwrap_or(0);
    if listen_secs > 0 {
        println!("== LISTENING {}s for button presses ==", listen_secs);
        let deadline = std::time::Instant::now() + Duration::from_secs(listen_secs);
        while let Ok((name, msg)) = rx.recv_timeout(deadline.saturating_duration_since(std::time::Instant::now())) {
            println!("  <- {:?}: {}", name, hex(&msg));
        }
    }
}
