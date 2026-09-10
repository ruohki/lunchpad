//! `profile.json` persistence with atomic writes and a one-deep backup
//! (`profile.json.bak`), mirroring the legacy `layout.old` safety net.

use super::model::Profile;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, thiserror::Error)]
pub enum ProfileError {
    #[error("Failed to read profile: {0}")]
    Read(String),
    #[error("Failed to write profile: {0}")]
    Write(String),
    #[error("Page not found: {0}")]
    PageNotFound(String),
    #[error("The default page cannot be removed")]
    DefaultPage,
    #[error("Invalid input: {0}")]
    Invalid(String),
}

pub type ProfileResult<T> = Result<T, ProfileError>;

pub struct ProfileStore {
    path: PathBuf,
    pub profile: Profile,
}

impl ProfileStore {
    pub fn load(config_dir: &Path) -> Self {
        let path = config_dir.join("profile.json");
        let profile = match fs::read_to_string(&path) {
            Ok(contents) => match serde_json::from_str::<Profile>(&contents) {
                Ok(mut p) => {
                    p.normalize();
                    p
                }
                Err(e) => {
                    tracing::error!(path = %path.display(), error = %e, "profile unreadable; starting empty (backup kept)");
                    let _ = fs::copy(&path, path.with_extension("json.unreadable"));
                    Profile::default()
                }
            },
            Err(_) => {
                tracing::info!(path = %path.display(), "no profile yet, creating default");
                Profile::default()
            }
        };
        let store = ProfileStore { path, profile };
        if !store.path.exists() {
            if let Err(e) = store.save() {
                tracing::warn!(error = %e, "could not write the initial profile");
            }
        }
        store
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn save(&self) -> ProfileResult<()> {
        let parent = self.path.parent().ok_or_else(|| ProfileError::Write("no parent dir".into()))?;
        fs::create_dir_all(parent).map_err(|e| ProfileError::Write(e.to_string()))?;
        let json = serde_json::to_string_pretty(&self.profile).map_err(|e| ProfileError::Write(e.to_string()))?;
        let tmp = self.path.with_extension("json.tmp");
        fs::write(&tmp, json).map_err(|e| ProfileError::Write(e.to_string()))?;
        if self.path.exists() {
            let _ = fs::copy(&self.path, self.path.with_extension("json.bak"));
        }
        fs::rename(&tmp, &self.path).map_err(|e| ProfileError::Write(e.to_string()))?;
        Ok(())
    }

    /// Replace the profile with the backup, if any.
    pub fn restore_backup(&mut self) -> ProfileResult<()> {
        let bak = self.path.with_extension("json.bak");
        let contents = fs::read_to_string(&bak).map_err(|e| ProfileError::Read(e.to_string()))?;
        let mut profile: Profile = serde_json::from_str(&contents).map_err(|e| ProfileError::Read(e.to_string()))?;
        profile.normalize();
        self.profile = profile;
        self.save()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::profile::model::{Button, Page};

    #[test]
    fn save_creates_backup_and_restores() {
        let dir = std::env::temp_dir().join(format!("lunchpad-test-{}", uuid::Uuid::new_v4()));
        let mut store = ProfileStore::load(&dir);
        store.save().unwrap();
        store.profile.pages.push(Page::new("second", "Second"));
        store.profile.pages[0].set(1, 1, Button::default());
        store.save().unwrap();
        assert!(dir.join("profile.json.bak").exists());
        store.restore_backup().unwrap();
        assert_eq!(store.profile.pages.len(), 1);
        let _ = fs::remove_dir_all(dir);
    }
}
