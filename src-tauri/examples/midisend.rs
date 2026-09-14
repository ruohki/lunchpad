//! Send raw MIDI messages to a port, for poking at a device's LED protocol.
//! `cargo run --example midisend -- "<port name part>" "90 60 05" "B0 73 7F" ...`
//! Each argument after the port is one message in hex bytes.
use midir::MidiOutput;

fn main() {
    let mut args = std::env::args().skip(1);
    let wanted = args.next().expect("usage: midisend <port name part> <hex message>...");
    let out = MidiOutput::new("midisend").unwrap();
    let port = out
        .ports()
        .into_iter()
        .find(|p| out.port_name(p).map(|n| n.contains(&wanted)).unwrap_or(false))
        .unwrap_or_else(|| panic!("no output port containing {wanted:?}"));
    println!("-> {}", out.port_name(&port).unwrap());
    let mut conn = out.connect(&port, "midisend").unwrap();
    for text in args {
        let bytes: Vec<u8> = text.split_whitespace().map(|h| u8::from_str_radix(h, 16).expect("hex byte")).collect();
        conn.send(&bytes).unwrap();
        println!("   sent {text}");
        std::thread::sleep(std::time::Duration::from_millis(30));
    }
    std::thread::sleep(std::time::Duration::from_millis(200));
}
