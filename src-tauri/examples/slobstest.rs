//! Exercises the Streamlabs Desktop integration against a running Streamlabs
//! using the app's settings: connect, list, hide and show a source, set audio,
//! start and stop the replay buffer, toggle studio mode, switch scene.
//! `cargo run --example slobstest [source-name]`
use lunchpad_lib::config::SettingsStore;
use lunchpad_lib::macros::{MuteMode, ObsMode, ObsTarget, StudioMode, VolumeUnit};
use lunchpad_lib::slobs::SlobsHandle;
use parking_lot::Mutex;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt().with_env_filter("lunchpad_lib=debug").init();
    let dir = PathBuf::from(std::env::var("HOME").unwrap()).join("Library/Application Support/com.lunchpad.app");
    let settings = Arc::new(Mutex::new(SettingsStore::load(&dir)));
    let slobs = SlobsHandle::spawn(None, settings, &tokio::runtime::Handle::current(), None);
    slobs.connect().await.expect("connect");
    let state = slobs.state();
    println!(
        "connected={} collection={:?} scenes={:?} current={:?}\nsources={:?}\naudio={:?}\nstreaming={} recording={} replay={} studio={}",
        state.connected, state.current_collection, state.scenes, state.current_scene, state.sources, state.audio_sources, state.streaming, state.recording, state.replay_buffer, state.studio_mode
    );
    let scene = state.current_scene.clone().or_else(|| state.scenes.first().cloned()).expect("a scene");
    let source = std::env::args().nth(1).or_else(|| state.audio_sources.first().cloned()).expect("a source");
    println!("filters of {source}: {:?}", slobs.filters(&source).await);
    println!("hide {source} in {scene}: {:?}", slobs.set_source_visible(None, &scene, &source, Some(false)).await);
    tokio::time::sleep(Duration::from_millis(800)).await;
    println!("show: {:?}", slobs.set_source_visible(None, &scene, &source, Some(true)).await);
    println!("mute + volume -20 dB: {:?}", slobs.set_audio(&source, MuteMode::Mute, Some((-20.0, VolumeUnit::Db))).await);
    tokio::time::sleep(Duration::from_millis(800)).await;
    println!("unmute + volume 0 dB: {:?}", slobs.set_audio(&source, MuteMode::Unmute, Some((0.0, VolumeUnit::Db))).await);
    println!("replay start: {:?}", slobs.output(ObsTarget::Replay, ObsMode::Start).await);
    tokio::time::sleep(Duration::from_millis(1500)).await;
    println!("replay status: {}", slobs.state().replay_buffer);
    println!("replay stop: {:?}", slobs.output(ObsTarget::Replay, ObsMode::Stop).await);
    println!("studio mode toggle: {:?}", slobs.studio_mode(StudioMode::Toggle).await);
    tokio::time::sleep(Duration::from_millis(800)).await;
    println!("studio mode now: {}", slobs.state().studio_mode);
    println!("studio mode toggle back: {:?}", slobs.studio_mode(StudioMode::Toggle).await);
    println!("switch scene {scene}: {:?}", slobs.switch_scene(None, &scene).await);
    println!("missing scene: {:?}", slobs.switch_scene(None, "no such scene").await);
    tokio::time::sleep(Duration::from_millis(800)).await;
    slobs.disconnect().await;
    println!("done");
}
