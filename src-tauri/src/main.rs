#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use crate::state::{connection_checker,get_connection_info,ConnectionInfoState};
use std::{sync::Mutex};

mod launchpads;
mod midi;
mod state;

#[tokio::main]
async fn main() {
  tauri::Builder::default()
    .manage(ConnectionInfoState(Mutex::new(None)))
    .manage(
      midi::Connection {
      input: Default::default(),
      output: Default::default(),
    })
    .invoke_handler(tauri::generate_handler![
      midi::connect,
      midi::disconnect,
      midi::list_devices,
      get_connection_info,
    ])
    .setup(|app| {
      let handle = app.handle();
      
      connection_checker(handle);

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
