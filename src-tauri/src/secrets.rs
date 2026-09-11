//! Where integration credentials live: the OBS password, the Streamlabs token,
//! the Home Assistant token, and whatever comes next. `settings.json` never
//! carries them; it is written with those fields blank and they are filled in
//! from this store when the settings load.
//!
//! Release builds use the operating system's credential store (Keychain on
//! macOS, Credential Manager on Windows, the Secret Service on Linux). Debug
//! builds use `secrets.json` next to the settings, readable by the user only:
//! every rebuild is a new binary to the macOS keychain and would prompt for
//! access again and again.

use parking_lot::Mutex;
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

/// Keychain service name; the key name is the account.
const SERVICE: &str = "com.lunchpad.app";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SecretKey {
    ObsPassword,
    SlobsToken,
    HomeAssistantToken,
}

impl SecretKey {
    pub const ALL: [SecretKey; 3] = [SecretKey::ObsPassword, SecretKey::SlobsToken, SecretKey::HomeAssistantToken];

    fn name(self) -> &'static str {
        match self {
            SecretKey::ObsPassword => "obs.password",
            SecretKey::SlobsToken => "slobs.token",
            SecretKey::HomeAssistantToken => "home-assistant.token",
        }
    }
}

enum Backend {
    Keychain,
    File(PathBuf),
}

pub struct SecretStore {
    backend: Backend,
    /// What the backend holds, so unchanged values are not rewritten on every save.
    cache: Mutex<BTreeMap<&'static str, String>>,
}

impl SecretStore {
    /// Open the store for this build: the OS store in release, a file in debug.
    pub fn open(config_dir: &Path) -> SecretStore {
        let backend = if cfg!(debug_assertions) { Backend::File(config_dir.join("secrets.json")) } else { Backend::Keychain };
        let store = SecretStore { backend, cache: Mutex::new(BTreeMap::new()) };
        store.load_all();
        store
    }

    /// For the diagnostics report.
    pub fn kind(&self) -> &'static str {
        match self.backend {
            Backend::Keychain => {
                if cfg!(target_os = "macos") {
                    "macOS Keychain"
                } else if cfg!(target_os = "windows") {
                    "Windows Credential Manager"
                } else {
                    "Secret Service"
                }
            }
            Backend::File(_) => "secrets.json (debug build)",
        }
    }

    pub fn get(&self, key: SecretKey) -> String {
        self.cache.lock().get(key.name()).cloned().unwrap_or_default()
    }

    /// Store `value`; an empty value removes the entry. Unchanged values are left alone.
    pub fn set(&self, key: SecretKey, value: &str) -> Result<(), String> {
        let value = value.trim();
        if self.cache.lock().get(key.name()).map(String::as_str).unwrap_or("") == value {
            return Ok(());
        }
        match &self.backend {
            Backend::Keychain => {
                let entry = keyring::Entry::new(SERVICE, key.name()).map_err(|e| e.to_string())?;
                if value.is_empty() {
                    match entry.delete_credential() {
                        Ok(()) | Err(keyring::Error::NoEntry) => {}
                        Err(e) => return Err(e.to_string()),
                    }
                } else {
                    entry.set_password(value).map_err(|e| e.to_string())?;
                }
            }
            Backend::File(path) => {
                let mut map = self.cache.lock().clone();
                if value.is_empty() {
                    map.remove(key.name());
                } else {
                    map.insert(key.name(), value.to_string());
                }
                write_file(path, &map)?;
            }
        }
        let mut cache = self.cache.lock();
        if value.is_empty() {
            cache.remove(key.name());
        } else {
            cache.insert(key.name(), value.to_string());
        }
        Ok(())
    }

    fn load_all(&self) {
        let mut cache = self.cache.lock();
        match &self.backend {
            Backend::Keychain => {
                for key in SecretKey::ALL {
                    let value = keyring::Entry::new(SERVICE, key.name()).and_then(|e| e.get_password());
                    match value {
                        Ok(v) if !v.is_empty() => {
                            cache.insert(key.name(), v);
                        }
                        Ok(_) | Err(keyring::Error::NoEntry) => {}
                        Err(e) => tracing::warn!(key = key.name(), error = %e, "credential store unreadable"),
                    }
                }
            }
            Backend::File(path) => {
                if let Ok(text) = std::fs::read_to_string(path) {
                    match serde_json::from_str::<BTreeMap<String, String>>(&text) {
                        Ok(map) => {
                            for key in SecretKey::ALL {
                                if let Some(v) = map.get(key.name()).filter(|v| !v.is_empty()) {
                                    cache.insert(key.name(), v.clone());
                                }
                            }
                        }
                        Err(e) => tracing::warn!(path = %path.display(), error = %e, "secrets file unreadable"),
                    }
                }
            }
        }
    }
}

fn write_file(path: &Path, map: &BTreeMap<&'static str, String>) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(map).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn file_store_round_trip() {
        let dir = std::env::temp_dir().join(format!("lunchpad-secrets-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let store = SecretStore { backend: Backend::File(dir.join("secrets.json")), cache: Mutex::new(BTreeMap::new()) };
        assert_eq!(store.get(SecretKey::ObsPassword), "");
        store.set(SecretKey::ObsPassword, " hunter2 ").unwrap();
        store.set(SecretKey::HomeAssistantToken, "abc").unwrap();
        let again = SecretStore { backend: Backend::File(dir.join("secrets.json")), cache: Mutex::new(BTreeMap::new()) };
        again.load_all();
        assert_eq!(again.get(SecretKey::ObsPassword), "hunter2");
        assert_eq!(again.get(SecretKey::HomeAssistantToken), "abc");
        again.set(SecretKey::ObsPassword, "").unwrap();
        let text = std::fs::read_to_string(dir.join("secrets.json")).unwrap();
        assert!(!text.contains("hunter2"));
        let _ = std::fs::remove_dir_all(&dir);
    }
}
