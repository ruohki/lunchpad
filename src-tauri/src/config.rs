//! Persisted application settings (`settings.json` in the app config dir).

use crate::midi::types::{LaunchpadModel, MidiError, MidiResult};
use parking_lot::Mutex;
use crate::secrets::{SecretKey, SecretStore};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;

pub type SharedSettings = Arc<Mutex<SettingsStore>>;

pub const SETTINGS_VERSION: u32 = 1;

/// The Launchpad the user chose last. Ports are stored by name because OS
/// port indices change whenever devices are plugged in or out.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SavedDevice {
    pub input_name: String,
    pub output_name: String,
    pub model: LaunchpadModel,
    #[serde(default)]
    pub firmware: Option<String>,
    /// A Launchpad-less session: the on-screen pads stand in for the device.
    #[serde(default, rename = "virtual")]
    pub is_virtual: bool,
}

/// Key held while a push-to-talk section of a macro runs.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PushToTalkSettings {
    #[serde(default)]
    pub enabled: bool,
    /// Key name in the app's key vocabulary (see `input::keys`), e.g. "f9", "v"
    #[serde(default)]
    pub key: String,
    /// "control", "alt", "shift", "command"
    #[serde(default)]
    pub modifiers: Vec<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioSettings {
    /// Default output device for sounds (`None` = the system default device)
    #[serde(default)]
    pub output_device: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ObsSettings {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_obs_host")]
    pub host: String,
    #[serde(default = "default_obs_port")]
    pub port: u16,
    #[serde(default)]
    pub password: String,
    #[serde(default = "default_true")]
    pub auto_connect: bool,
}

fn default_obs_host() -> String {
    "localhost".into()
}
fn default_obs_port() -> u16 {
    4455
}

impl Default for ObsSettings {
    fn default() -> Self {
        ObsSettings { enabled: false, host: default_obs_host(), port: default_obs_port(), password: String::new(), auto_connect: true }
    }
}

/// Streamlabs Desktop's JSON-RPC server: plain TCP on 127.0.0.1:28194 whenever
/// the app runs; local clients need no token.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SlobsSettings {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_slobs_host")]
    pub host: String,
    #[serde(default = "default_slobs_port")]
    pub port: u16,
    /// API token (Settings → Remote Control); only checked for remote hosts
    #[serde(default)]
    pub token: String,
    #[serde(default = "default_true")]
    pub auto_connect: bool,
}

fn default_slobs_host() -> String {
    "127.0.0.1".into()
}
fn default_slobs_port() -> u16 {
    28194
}

impl Default for SlobsSettings {
    fn default() -> Self {
        SlobsSettings { enabled: false, host: default_slobs_host(), port: default_slobs_port(), token: String::new(), auto_connect: true }
    }
}

/// Home Assistant over its REST API with a long-lived access token.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HomeAssistantSettings {
    #[serde(default)]
    pub enabled: bool,
    /// Base URL of the instance, e.g. `http://homeassistant.local:8123`
    #[serde(default = "default_ha_url")]
    pub url: String,
    /// Long-lived access token (profile page → Security)
    #[serde(default)]
    pub token: String,
    /// Accept a self-signed certificate on an https URL
    #[serde(default)]
    pub ignore_tls_errors: bool,
}

fn default_ha_url() -> String {
    "http://homeassistant.local:8123".into()
}

impl Default for HomeAssistantSettings {
    fn default() -> Self {
        HomeAssistantSettings { enabled: false, url: default_ha_url(), token: String::new(), ignore_tls_errors: false }
    }
}

/// Window behaviour, also reachable from the tray menu.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowSettings {
    #[serde(default)]
    pub stay_on_top: bool,
    /// Closing the window hides it; the tray icon brings it back.
    #[serde(default)]
    pub minimize_to_tray: bool,
    /// Registered with the OS through the autostart plugin on every start.
    #[serde(default)]
    pub run_at_startup: bool,
    /// Open in the tray only; the window appears on demand.
    #[serde(default)]
    pub start_hidden: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    #[serde(default = "default_version")]
    pub version: u32,
    #[serde(default)]
    pub device: Option<SavedDevice>,
    /// Reconnect to `device` automatically on start-up and when it is plugged in.
    #[serde(default = "default_true")]
    pub auto_connect: bool,
    /// Light a pad while it is held (useful before pages/macros exist).
    #[serde(default = "default_true")]
    pub press_feedback: bool,
    /// Lowest velocity that counts as a press on velocity-sensitive pads;
    /// `None` keeps the model's default (25).
    #[serde(default)]
    pub press_threshold: Option<u8>,
    #[serde(default)]
    pub push_to_talk: PushToTalkSettings,
    #[serde(default)]
    pub audio: AudioSettings,
    #[serde(default)]
    pub obs: ObsSettings,
    #[serde(default)]
    pub slobs: SlobsSettings,
    #[serde(default)]
    pub home_assistant: HomeAssistantSettings,
    #[serde(default)]
    pub window: WindowSettings,
    /// Show diagnostics in the main window (device facts, MIDI monitor, variables).
    #[serde(default)]
    pub developer_mode: bool,
    /// Names of the user's secrets (`{{secret.<name>}}`); the values are in the credential store.
    #[serde(default)]
    pub secrets: Vec<String>,
}

fn default_version() -> u32 {
    SETTINGS_VERSION
}
fn default_true() -> bool {
    true
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            version: SETTINGS_VERSION,
            device: None,
            auto_connect: true,
            press_feedback: true,
            press_threshold: None,
            push_to_talk: PushToTalkSettings::default(),
            audio: AudioSettings::default(),
            obs: ObsSettings::default(),
            slobs: SlobsSettings::default(),
            home_assistant: HomeAssistantSettings::default(),
            window: WindowSettings::default(),
            developer_mode: false,
            secrets: Vec::new(),
        }
    }
}

pub struct SettingsStore {
    path: PathBuf,
    pub settings: Settings,
    /// Integration credentials live here, not in the settings file.
    pub secrets: SecretStore,
}

impl Settings {
    /// The credentials, in a fixed order, for moving them between the file and the store.
    fn secret_fields(&mut self) -> [(SecretKey, &mut String); 3] {
        [(SecretKey::ObsPassword, &mut self.obs.password), (SecretKey::SlobsToken, &mut self.slobs.token), (SecretKey::HomeAssistantToken, &mut self.home_assistant.token)]
    }
}

impl SettingsStore {
    pub fn load(config_dir: &Path) -> Self {
        let path = config_dir.join("settings.json");
        let mut settings = match fs::read_to_string(&path) {
            Ok(contents) => match serde_json::from_str::<Settings>(&contents) {
                Ok(s) => s,
                Err(e) => {
                    tracing::warn!(path = %path.display(), error = %e, "settings unreadable, using defaults");
                    Settings::default()
                }
            },
            Err(_) => Settings::default(),
        };
        let secrets = SecretStore::open(config_dir);
        settings.secrets.retain(|n| crate::secrets::valid_secret_name(n));
        settings.secrets.sort();
        settings.secrets.dedup();
        secrets.load_users(&settings.secrets);
        // Credentials still sitting in the file (older versions kept them there) move to
        // the store; otherwise the store fills the blanks.
        let mut migrated = false;
        for (key, field) in settings.secret_fields() {
            if !field.trim().is_empty() {
                match secrets.set(key, field) {
                    Ok(()) => migrated = true,
                    Err(e) => tracing::warn!(error = %e, "credential could not be moved to the store, keeping it in the settings file"),
                }
            } else {
                *field = secrets.get(key);
            }
        }
        tracing::info!(path = %path.display(), credentials = secrets.kind(), "settings loaded");
        let store = SettingsStore { path, settings, secrets };
        if migrated {
            if let Err(e) = store.save() {
                tracing::warn!(error = %e, "settings could not be rewritten without credentials");
            }
        }
        store
    }

    pub fn save(&self) -> MidiResult<()> {
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent).map_err(|e| MidiError::Settings(e.to_string()))?;
        }
        // Credentials go to the store; the file gets them blanked. If the store refuses
        // one, it stays in the file rather than being lost.
        let mut on_disk = self.settings.clone();
        for (key, field) in on_disk.secret_fields() {
            match self.secrets.set(key, field) {
                Ok(()) => field.clear(),
                Err(e) => tracing::warn!(error = %e, "credential store rejected a value, keeping it in the settings file"),
            }
        }
        let json = serde_json::to_string_pretty(&on_disk).map_err(|e| MidiError::Settings(e.to_string()))?;
        fs::write(&self.path, json).map_err(|e| MidiError::Settings(e.to_string()))
    }

    /// Add or replace a named secret and remember its name.
    pub fn set_user_secret(&mut self, name: &str, value: &str) -> Result<(), String> {
        let name = name.trim();
        if value.trim().is_empty() {
            return Err("the secret is empty".into());
        }
        self.secrets.set_user(name, value)?;
        if !self.settings.secrets.iter().any(|n| n == name) {
            self.settings.secrets.push(name.to_string());
            self.settings.secrets.sort();
        }
        self.save().map_err(|e| e.to_string())
    }

    /// Forget a named secret: its value and its name.
    pub fn remove_user_secret(&mut self, name: &str) -> Result<(), String> {
        let name = name.trim();
        self.secrets.set_user(name, "")?;
        self.settings.secrets.retain(|n| n != name);
        self.save().map_err(|e| e.to_string())
    }
}
