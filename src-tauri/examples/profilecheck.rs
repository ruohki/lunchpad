//! Parses the profile in the app's config folder with the real model and
//! prints a summary, so a hand-written profile can be checked before the app
//! loads (and possibly replaces) it. `cargo run --example profilecheck`
use lunchpad_lib::profile::Profile;
use std::path::PathBuf;

fn main() {
    let path = PathBuf::from(std::env::var("HOME").unwrap()).join("Library/Application Support/com.lunchpad.app/profile.json");
    let text = std::fs::read_to_string(&path).expect("profile.json");
    match serde_json::from_str::<Profile>(&text) {
        Ok(profile) => {
            for page in &profile.pages {
                let actions: usize = page.buttons.iter().map(|b| b.button.down.len() + b.button.up.len() + b.button.hold.len()).sum::<usize>() + page.faders.iter().map(|f| f.on_change.len()).sum::<usize>();
                println!("{:<10} buttons={:<3} faders={} actions={}", page.name, page.buttons.len(), page.faders.len(), actions);
            }
            println!("ok: {} pages", profile.pages.len());
        }
        Err(e) => {
            println!("INVALID: {e}");
            std::process::exit(1);
        }
    }
}
