//! Where credentials live: the OBS password, the Streamlabs token, the Home
//! Assistant token, and the user's own named secrets (API keys for HTTP
//! actions, used as `{{secret.<name>}}`). `settings.json` never carries a
//! value; integration fields are written blank and filled in from this store
//! when the settings load, and of the named secrets only the names are kept
//! in the settings file.
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

/// Entry name prefix of the user's named secrets.
const USER_PREFIX: &str = "user.";

/// Names of user secrets: letters, digits, `_` and `-`, up to 64 characters,
/// so `{{secret.<name>}}` is unambiguous and the name is safe as a keychain account.
pub fn valid_secret_name(name: &str) -> bool {
    !name.is_empty() && name.len() <= 64 && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

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
    cache: Mutex<BTreeMap<String, String>>,
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
        self.set_entry(key.name(), value)
    }

    /// The user's named secrets, name → value, for `{{secret.<name>}}`.
    pub fn users(&self) -> BTreeMap<String, String> {
        self.cache
            .lock()
            .iter()
            .filter_map(|(k, v)| k.strip_prefix(USER_PREFIX).map(|name| (name.to_string(), v.clone())))
            .collect()
    }

    /// Store a named secret; an empty value removes it.
    pub fn set_user(&self, name: &str, value: &str) -> Result<(), String> {
        if !valid_secret_name(name) {
            return Err("secret names use letters, digits, _ and - only".into());
        }
        self.set_entry(&format!("{USER_PREFIX}{name}"), value)
    }

    /// Fetch the named secrets the settings file lists (the OS store cannot be
    /// enumerated); the file backend already holds them all.
    pub fn load_users(&self, names: &[String]) {
        if let Backend::Keychain = self.backend {
            let mut cache = self.cache.lock();
            for name in names {
                let entry = format!("{USER_PREFIX}{name}");
                match keyring::Entry::new(SERVICE, &entry).and_then(|e| e.get_password()) {
                    Ok(v) if !v.is_empty() => {
                        cache.insert(entry, v);
                    }
                    Ok(_) | Err(keyring::Error::NoEntry) => tracing::warn!(name, "named secret is listed but the credential store has no value for it"),
                    Err(e) => tracing::warn!(name, error = %e, "credential store unreadable"),
                }
            }
        }
    }

    fn set_entry(&self, name: &str, value: &str) -> Result<(), String> {
        let value = value.trim();
        if self.cache.lock().get(name).map(String::as_str).unwrap_or("") == value {
            return Ok(());
        }
        match &self.backend {
            Backend::Keychain => {
                let entry = keyring::Entry::new(SERVICE, name).map_err(|e| e.to_string())?;
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
                    map.remove(name);
                } else {
                    map.insert(name.to_string(), value.to_string());
                }
                write_file(path, &map)?;
            }
        }
        let mut cache = self.cache.lock();
        if value.is_empty() {
            cache.remove(name);
        } else {
            cache.insert(name.to_string(), value.to_string());
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
                            cache.insert(key.name().to_string(), v);
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
                            for (k, v) in map {
                                if !v.is_empty() {
                                    cache.insert(k, v);
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

fn write_file(path: &Path, map: &BTreeMap<String, String>) -> Result<(), String> {
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

    #[test]
    fn named_secrets() {
        let dir = std::env::temp_dir().join(format!("lunchpad-secrets-user-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let store = SecretStore { backend: Backend::File(dir.join("secrets.json")), cache: Mutex::new(BTreeMap::new()) };
        assert!(store.set_user("bad name", "x").is_err());
        assert!(store.set_user("", "x").is_err());
        store.set_user("elevenlabs", " sk-123 ").unwrap();
        store.set_user("other_1", "abc").unwrap();
        store.set(SecretKey::ObsPassword, "pw").unwrap();
        let users = store.users();
        assert_eq!(users.get("elevenlabs").map(String::as_str), Some("sk-123"));
        assert_eq!(users.len(), 2, "integration credentials are not named secrets");
        let again = SecretStore { backend: Backend::File(dir.join("secrets.json")), cache: Mutex::new(BTreeMap::new()) };
        again.load_all();
        assert_eq!(again.users().get("other_1").map(String::as_str), Some("abc"));
        assert_eq!(again.get(SecretKey::ObsPassword), "pw");
        again.set_user("elevenlabs", "").unwrap();
        assert!(again.users().get("elevenlabs").is_none());
        assert!(!std::fs::read_to_string(dir.join("secrets.json")).unwrap().contains("sk-123"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn secret_names() {
        assert!(valid_secret_name("elevenlabs"));
        assert!(valid_secret_name("open-ai_2"));
        assert!(!valid_secret_name("with space"));
        assert!(!valid_secret_name("dots.here"));
        assert!(!valid_secret_name(&"x".repeat(65)));
    }
}
