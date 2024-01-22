use std::error::Error;
use std::sync::Mutex;
use serde::{Serialize, Deserialize};
use app_dirs2::*;
use std::fs::{self, create_dir_all};
use std::path::PathBuf;

const APP_INFO: AppInfo = AppInfo{name: "Lunchpad", author: "Lunchpad"};

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
pub struct ApplicationConfiguration {
  pub stay_on_top: bool,
  pub minimize_to_tray: bool,
  pub run_on_startup: bool,
}

pub struct ApplicationConfigurationState(pub Mutex<ApplicationConfiguration>);

impl ApplicationConfiguration {
  pub fn save(&self) -> Result<(), Box<dyn Error>> {
    if let Ok(config_path) = get_app_root(AppDataType::UserConfig, &APP_INFO) {
      if config_path.exists() == false {
        create_dir_all(&config_path)?;
      }

      let config_file = PathBuf::from(&config_path).join("config.json");
      let serialized_config = serde_json::to_string(self)?;
      fs::write(config_file, serialized_config)?;
    
      //toml::to_string(self)
      Ok(())
    } else { 
      panic!("Cannot access os specific configuration path");
    }
  }

  pub fn load_or_init() -> Result<Self, Box<dyn Error>> {
    if let Ok(config_path) = get_app_root(AppDataType::UserConfig, &APP_INFO) {
      let config_file = PathBuf::from(&config_path).join("config.json");
      if config_file.exists() {
        let data = fs::read_to_string(config_file)?;
        if let Ok(config) = serde_json::from_str::<ApplicationConfiguration>(data.as_str()) {
          return Ok(config);
        }
      }
    }

    Ok(ApplicationConfiguration { stay_on_top: false, run_on_startup: false, minimize_to_tray: true })
  }
}

/* #[tauri::command]
pub fn get_configuration(
  config: State<ApplicationConfigurationState>
) -> ApplicationConfiguration {
  let config = &*config.0.lock().unwrap();
  config.clone()
} */