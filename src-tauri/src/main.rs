#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use crate::configuration::{ApplicationConfiguration, ApplicationConfigurationState, get_configuration};

use crate::state::{connection_checker,get_connection_info,ConnectionInfoState};
use std::{sync::Mutex};

mod launchpads;
mod midi;
mod state;
mod configuration;

#[tokio::main]
async fn main() {
  // Load Saved application configuration or create a new one from scratch
  let config = ApplicationConfiguration::load_or_init().unwrap();
  
  tauri::Builder::default()
    .manage(ApplicationConfigurationState(Mutex::new(config)))
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
      get_configuration
    ])
    .setup(|app| {
      let handle = app.handle();
      
      connection_checker(handle);

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
