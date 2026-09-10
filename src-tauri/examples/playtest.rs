//! Lists audio output devices and plays a file on the default device (or a named one):
//! `cargo run --example playtest -- /path/to/sound.wav ["Device name"]`
use lunchpad_lib::audio::{spawn_audio, PlayRequest};
use std::path::PathBuf;

#[tokio::main]
async fn main() {
    let file = std::env::args().nth(1).expect("usage: playtest <file> [device]");
    let device = std::env::args().nth(2);
    let audio = spawn_audio();
    let devices = audio.devices().await;
    println!("default: {:?}", devices.default);
    for d in &devices.devices {
        println!("  - {d}");
    }
    let info = lunchpad_lib::audio::peaks::analyze(&PathBuf::from(&file), 16).expect("analyze");
    println!("duration {:.2}s, peaks {:?}", info.duration_secs, info.peaks.iter().map(|p| (p * 10.0).round() / 10.0).collect::<Vec<_>>());
    let (id, done) = audio.play(PlayRequest { file: PathBuf::from(file), device, volume: 0.6, start: 0.0, end: 1.0 });
    println!("playing #{id}…");
    match done.await {
        Ok(Ok(())) => println!("finished"),
        Ok(Err(e)) => println!("failed: {e}"),
        Err(_) => println!("audio thread gone"),
    }
}
