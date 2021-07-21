#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

mod midi;

use tokio::sync::oneshot;
use std::time::Duration;

#[tauri::command]
async fn test() -> u8 {
  let (sender, receiver) = oneshot::channel::<u8>();
  tokio::spawn(async move {
    let ten_millis = Duration::from_millis(5000);
    std::thread::sleep(ten_millis);
    sender.send(69).unwrap();
  });

  match receiver.await {
    Ok(v) => {
      println!("got = {:?}", v)
    },
    Err(err) => println!("the sender dropped, {}", err),
  }

  69u8
}

#[tokio::main]
async fn main() {
  tauri::Builder::default()
  .manage(midi::Connection { input: Default::default(), output: Default::default() })
  .invoke_handler(tauri::generate_handler![
    midi::connect,
    midi::disconnect,
    midi::list_devices,
    test
  ])
  .run(tauri::generate_context!())
  .expect("error while running tauri application");
}
