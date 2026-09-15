//! Hardware check for the Launchpad Pro [MK3] mode sequence.
//!
//! The manual's mode hierarchy puts Programmer beside Live and DAW mode, so a
//! device a DAW left in Session ignores the Programmer toggle on its own. This
//! reproduces that and checks the fix:
//!
//!   1. `10h 01h` DAW mode on   (the state a DAW leaves behind)
//!   2. `0Eh 01h` Programmer    (old init) → the lower left pad should stay dark
//!   3. `10h 00h` Standalone + `0Eh 01h` Programmer (new init) → it should light red
//!
//! Presses are printed throughout: in Programmer mode the lower left pad is
//! note 11. `cargo run --example promk3mode`
use midir::{Ignore, MidiInput, MidiOutput};
use std::io::Write;
use std::thread::sleep;
use std::time::Duration;

const HEADER: [u8; 6] = [0xF0, 0x00, 0x20, 0x29, 0x02, 0x0E];
/// Lower left pad of the 8x8 grid in Programmer mode.
const PAD: u8 = 11;
const RED: u8 = 5;

fn sysex(body: &[u8]) -> Vec<u8> {
    let mut m = HEADER.to_vec();
    m.extend_from_slice(body);
    m.push(0xF7);
    m
}

/// The interface the app drives: the MK3's first pair ("MIDI"), not DAW or DIN.
fn is_midi_port(name: &str) -> bool {
    let n = name.to_lowercase();
    (n.contains("promk3") || n.contains("pro mk3")) && !n.contains("daw") && !n.contains("din")
}

fn step(label: &str) {
    println!("\n== {label}");
    std::io::stdout().flush().ok();
}

fn main() {
    let out = MidiOutput::new("promk3mode").unwrap();
    let port = out
        .ports()
        .into_iter()
        .find(|p| out.port_name(p).map(|n| is_midi_port(&n)).unwrap_or(false))
        .expect("no Launchpad Pro MK3 MIDI output port (is it plugged in?)");
    println!("output: {}", out.port_name(&port).unwrap());

    let mut midi_in = MidiInput::new("promk3mode-in").unwrap();
    midi_in.ignore(Ignore::None);
    let in_port = midi_in.ports().into_iter().find(|p| midi_in.port_name(p).map(|n| is_midi_port(&n)).unwrap_or(false));
    let _conn_in = in_port.map(|p| {
        println!("input:  {}", midi_in.port_name(&p).unwrap());
        midi_in
            .connect(
                &p,
                "promk3mode-in",
                |_, msg, _| println!("   <- {}", msg.iter().map(|b| format!("{b:02X}")).collect::<Vec<_>>().join(" ")),
                (),
            )
            .unwrap()
    });

    let mut conn = out.connect(&port, "promk3mode").unwrap();
    let light = |conn: &mut midir::MidiOutputConnection, on: bool| {
        conn.send(&[0x90, PAD, if on { RED } else { 0 }]).unwrap();
    };

    step("1. DAW mode on (what a DAW leaves behind)");
    conn.send(&sysex(&[0x10, 0x01])).unwrap();
    sleep(Duration::from_millis(600));

    step("2. old init: Programmer toggle alone, then light the lower left pad red");
    conn.send(&sysex(&[0x0E, 0x01])).unwrap();
    sleep(Duration::from_millis(300));
    light(&mut conn, true);
    println!("   look at the device: is the lower left pad RED? (expected: no, it stays dark)");
    sleep(Duration::from_secs(6));
    light(&mut conn, false);

    step("3. new init: Standalone, then Programmer, then light the same pad");
    conn.send(&sysex(&[0x10, 0x00])).unwrap();
    sleep(Duration::from_millis(300));
    conn.send(&sysex(&[0x0E, 0x01])).unwrap();
    sleep(Duration::from_millis(300));
    light(&mut conn, true);
    println!("   look at the device: the lower left pad should now be RED");
    println!("   press a few pads; in Programmer mode the lower left one reports note 11");
    sleep(Duration::from_secs(12));

    step("done: back to Live mode");
    light(&mut conn, false);
    conn.send(&sysex(&[0x0E, 0x00])).unwrap();
    sleep(Duration::from_millis(200));
}
