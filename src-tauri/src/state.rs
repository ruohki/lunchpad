use crate::midi::{Device, input_from_idx, output_from_idx};
use crate::launchpads::LaunchpadType;

use std::{sync::Mutex, time::Duration};
use tokio::{task, time};

use tauri::{AppHandle, State, Manager};
use serde::Serialize;

#[derive(Clone, Serialize)]
pub struct StringPayload {
  pub message: String
}

#[derive(Debug, Clone, Serialize)]
pub struct ConnectionInfo {
  pub input: Device,
  pub output: Device,
  pub launchpad_type: LaunchpadType
}

pub struct ConnectionInfoState(pub Mutex<Option<ConnectionInfo>>);

/**
 * Task to check for an active launchpad connection since there are no disconnect events :(
*/
pub fn connection_checker(handle: AppHandle) {
  task::spawn(async move {
    let mut interval = time::interval(Duration::from_millis(500));

    loop {
      let connection_info_state: State<ConnectionInfoState> = handle.state();

      let mut disconnected: bool = false;
      if let Some(connection_info) = &*connection_info_state.0.lock().unwrap() {
        if let Some(input) = input_from_idx(connection_info.input.idx) {
          if input.name != connection_info.input.name {
            disconnected = true;
          }
        } 
        if let Some(output) = output_from_idx(connection_info.input.idx) {
          if output.name != connection_info.output.name {
            disconnected = true;
          }
        }
      }

      if disconnected == true {
        handle.emit_all("device_disconnected", StringPayload { message: "Device has been disconnected".into() }).unwrap();
        *connection_info_state.0.lock().unwrap() = None;
      }

      interval.tick().await;
    }
  });
}


#[tauri::command]
pub fn get_connection_info(connection_info: State<'_, ConnectionInfoState>) -> Option<ConnectionInfo> {
  let result = &*connection_info.0.lock().unwrap();
  result.clone()
}