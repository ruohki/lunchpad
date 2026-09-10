//! Hardware check for MK2 flash/pulse SysEx (manual v1.03: `23h 00h <LED> <Colour>`,
//! `28h 00h <LED> <Colour>`). Lights the SECOND row from the bottom of the first
//! Launchpad MK2 found: pad 1 solid red, pad 2 flashing red/green, pad 3 pulsing
//! red, pads 4-5 solid red. `cargo run --example ledtest`
use midir::MidiOutput;

fn sysex(body: &[u8]) -> Vec<u8> {
    let mut m = vec![0xF0, 0x00, 0x20, 0x29, 0x02, 0x18];
    m.extend_from_slice(body);
    m.push(0xF7);
    m
}

fn main() {
    let out = MidiOutput::new("ledtest").unwrap();
    let port = out
        .ports()
        .into_iter()
        .find(|p| out.port_name(p).map(|n| n.contains("Launchpad MK2")).unwrap_or(false))
        .expect("no Launchpad MK2 output port");
    let mut conn = out.connect(&port, "ledtest").unwrap();
        conn.send(&sysex(&[0x0A, 21, 5, 22, 5, 23, 5, 24, 5, 25, 5])).unwrap(); // bottom row red
    conn.send(&sysex(&[0x23, 0x00, 22, 21])).unwrap(); // flash pad 2 between red and green
    conn.send(&sysex(&[0x28, 0x00, 23, 5])).unwrap(); // pulse pad 3 red
    println!("sent; second row from the bottom: pad 2 should flash red/green, pad 3 should pulse red");
    std::thread::sleep(std::time::Duration::from_millis(200));
}
