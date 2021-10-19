use crate::launchpads::LaunchpadType;
use crate::midi::Device;

use std::error::Error;
use std::sync::Mutex;
use serde::{Serialize, Deserialize};
use app_dirs2::*;
use tauri::State;
use std::fs::{self, create_dir_all};
use std::path::PathBuf;

const APP_INFO: AppInfo = AppInfo{name: "Lunchpad", author: "Lunchpad"};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ApplicationConfiguration {
  pub input: Option<Device>,
  pub output: Option<Device>,
  pub launchpad_type: Option<LaunchpadType>
}

pub struct ApplicationConfigurationState(pub Mutex<ApplicationConfiguration>);

impl ApplicationConfiguration {
  pub fn save(&self) -> Result<(), Box<dyn Error>> {
    if let Ok(config_path) = get_app_root(AppDataType::UserConfig, &APP_INFO) {
      if config_path.exists() == false {
        create_dir_all(&config_path)?;
      }

      let config_file = PathBuf::from(&config_path).join("config.toml");
      let serialized_config = toml::to_string(self)?;
      fs::write(config_file, serialized_config)?;
    
      //toml::to_string(self)
      Ok(())
    } else {
      panic!("Cannot access os specific configuration path");
    }
  }

  pub fn load_or_init() -> Result<Self, Box<dyn Error>> {
    if let Ok(config_path) = get_app_root(AppDataType::UserConfig, &APP_INFO) {
      let config_file = PathBuf::from(&config_path).join("config.toml");
      if config_file.exists() {
        let data = fs::read_to_string(config_file)?;
        let config = toml::from_str::<ApplicationConfiguration>(data.as_str())?;
        println!("{:?}", config);
        return Ok(config);
      }
    }

    Ok(ApplicationConfiguration { input: None, output: None, launchpad_type: None })
  }
}

#[tauri::command]
pub fn get_configuration(
  config: State<ApplicationConfigurationState>
) -> ApplicationConfiguration {
  let config = &*config.0.lock().unwrap();
  config.clone()
}