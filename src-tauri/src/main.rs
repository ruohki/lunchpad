// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod midi;
mod launchpad;

use midi::commands::enumerate_devices;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![enumerate_devices])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");


}
