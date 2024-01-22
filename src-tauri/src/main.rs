// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod launchpad;
mod midi;
mod configuration;

use std::sync::{Arc, Mutex};

use configuration::{ApplicationConfiguration, ApplicationConfigurationState};
use midi::commands::enumerate_devices;
use tauri::{api::shell, CustomMenuItem, Manager, SystemTray, SystemTrayEvent, SystemTrayMenu, SystemTrayMenuItem};
use tauri_plugin_window_state::{StateFlags, WindowExt};

fn main() {
  // Load Saved appl3ication configuration or create a new one from scratch
  let config = ApplicationConfiguration::load_or_init().unwrap();

  // Setup Menu Item state according to config.yml
  let mut stay_on_top_item = CustomMenuItem::new("stay_on_top".to_string(),"Stay on top");
  let mut minimize_to_tray_item = CustomMenuItem::new("minimize_to_tray".to_string(),"Minimize to tray");
  let mut run_at_statup_item = CustomMenuItem::new("run_at_startup".to_string(),"Run at startup");

  stay_on_top_item.selected = config.stay_on_top;
  minimize_to_tray_item.selected = config.minimize_to_tray;
  run_at_statup_item.selected = config.run_on_startup;
  run_at_statup_item.enabled = false;
  
  // Construct System Tray Menu
  let tray_menu = SystemTrayMenu::new()
    .add_item(CustomMenuItem::new("discord".to_string(),"Join the Discord!"))
    .add_native_item(SystemTrayMenuItem::Separator)
    .add_item(CustomMenuItem::new("show".to_string(),"Show Lunchpad"))
    .add_native_item(SystemTrayMenuItem::Separator)
    .add_item(stay_on_top_item)
    .add_item(minimize_to_tray_item)
    .add_item(run_at_statup_item)
    .add_native_item(SystemTrayMenuItem::Separator)
    .add_item(CustomMenuItem::new("stop_all".to_string(),"Stop all running macros"))
    .add_native_item(SystemTrayMenuItem::Separator)
    .add_item(CustomMenuItem::new("quit".to_string(),"Quit"));

  tauri::Builder::default()
    .manage(ApplicationConfigurationState(Mutex::new(config)))
    .plugin(tauri_plugin_window_state::Builder::default().build())
    .system_tray(SystemTray::new().with_menu(tray_menu))
    .on_window_event(|event| match event.event() {
      tauri::WindowEvent::Focused(focus) => {
        let config = event.window().state::<ApplicationConfigurationState>();
        if event.window().is_minimized().unwrap() == true && *focus == false {
          let config = config.inner().0.lock().unwrap();
          if config.minimize_to_tray == false {
            event.window().set_skip_taskbar(true).unwrap();
            event.window().hide().unwrap();
          }
          println!("Minimized!");
        }
      }
      _ => {}
    })
    .on_system_tray_event(|app, event| {
      let window = app.get_window("main").unwrap();
      match event {
        SystemTrayEvent::LeftClick {
          position: _,
          size: _,
          ..
        } => {
          window.unminimize().unwrap();
          window.show().unwrap();
          window.set_skip_taskbar(false).unwrap();
          window.set_focus().unwrap();
        }
        SystemTrayEvent::MenuItemClick { id, .. } => {
          let item_handle = app.tray_handle().get_item(&id);
          let config = app.state::<ApplicationConfigurationState>();
          let mut config = config.inner().0.lock().unwrap();
          
          match id.as_str() {
            "discord" => {
              shell::open(&app.shell_scope(), "https://discord.com/invite/4Ys9TRR", None).unwrap();
            }
            "stay_on_top" => {
              config.stay_on_top = !config.stay_on_top;
              item_handle.set_selected(config.stay_on_top).unwrap();
              window.set_always_on_top(config.stay_on_top).unwrap();
              config.save().unwrap();
            }
            "minimize_to_tray" => {
              config.minimize_to_tray = !config.minimize_to_tray;
              item_handle.set_selected(config.minimize_to_tray).unwrap();
              config.save().unwrap();
            }
            "run_at_startup" => {}
            "quit" => {
              std::process::exit(0);
            }
            "show" => {
              window.set_skip_taskbar(false).unwrap();
              window.unminimize().unwrap();
              window.show().unwrap();
              window.set_focus().unwrap();
            }
            _ => {}
          }
        } 
        _ => {}
      }
    })
    .invoke_handler(tauri::generate_handler![enumerate_devices])
 
    .setup(|app| {
      let main_window = app.get_window("main").unwrap();
      let config = app.state::<ApplicationConfigurationState>();
      let config = config.inner().0.lock().unwrap();
      println!("Loaded Config: {config:?}");

      main_window.set_always_on_top(config.stay_on_top).unwrap();
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
