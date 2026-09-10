//! Exercises the OBS integration against a live OBS using the app's settings:
//! connect, list, hide and show a source, toggle recording twice.
//! `cargo run --example obstest [source-name]`
use lunchpad_lib::config::SettingsStore;
use lunchpad_lib::macros::{MuteMode, ObsMode, ObsTarget, VolumeUnit};
use lunchpad_lib::obs::ObsHandle;
use parking_lot::Mutex;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

#[tokio::main]
async fn main() {
    let dir = PathBuf::from(std::env::var("HOME").unwrap()).join("Library/Application Support/com.lunchpad.app");
    let settings = Arc::new(Mutex::new(SettingsStore::load(&dir)));
    let obs = ObsHandle::spawn(None, settings, &tokio::runtime::Handle::current(), None);
    obs.connect().await.expect("connect");
    let state = obs.state();
    println!("connected={} collection={:?} scenes={:?} inputs={:?}", state.connected, state.current_collection, state.scenes, state.inputs);
    let scene = state.current_scene.clone().or_else(|| state.scenes.first().cloned()).expect("a scene");
    let source = std::env::args().nth(1).or_else(|| state.inputs.first().cloned()).expect("a source");
    println!("filters of {source}: {:?}", obs.filters(&source).await);
    println!("hide {source} in {scene}: {:?}", obs.set_source_visible(None, &scene, &source, Some(false)).await);
    tokio::time::sleep(Duration::from_millis(800)).await;
    println!("show: {:?}", obs.set_source_visible(None, &scene, &source, Some(true)).await);
    println!("mute + volume: {:?}", obs.set_audio(&source, MuteMode::Unmute, Some((-6.0, VolumeUnit::Db))).await);
    println!("record toggle: {:?}", obs.output(ObsTarget::Record, ObsMode::Toggle).await);
    tokio::time::sleep(Duration::from_millis(1500)).await;
    println!("record toggle again: {:?}", obs.output(ObsTarget::Record, ObsMode::Toggle).await);
    println!("switch scene {scene}: {:?}", obs.switch_scene(None, &scene).await);
    obs.disconnect().await;
    println!("done");
}
