//! `profile.json` persistence with atomic writes and a one-deep backup
//! (`profile.json.bak`), mirroring the legacy `layout.old` safety net.
//!
//! The file is written on a thread of its own, so a change never holds the
//! profile lock - and with it the LED renderer and every running macro -
//! while the disk is busy. What the user arranges goes to disk at once; the
//! state a running macro changes (a fader's level, a pad's colour, the active
//! page) is collected for a moment first, because a knob or a loop produces
//! those by the hundred per second.
//!
//! Only an edit refreshes the backup. It is meant to hold the profile as the
//! user last arranged it, which a fader moving a moment ago must not push out.

use super::model::Profile;
use crossbeam_channel::{bounded, unbounded, Receiver, RecvTimeoutError, Sender};
use parking_lot::Mutex;
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

/// How long a run of macro-driven changes is collected before it is written.
const COALESCE: Duration = Duration::from_millis(300);
/// The longest a change may wait while they keep arriving.
const MAX_DELAY: Duration = Duration::from_secs(2);

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

/// What a save is for.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SaveKind {
    /// The user arranged something, or an import, an undo or a restore did:
    /// written at once, and the profile it replaces becomes the backup.
    Edit,
    /// State a running macro changed - a fader's level, a pad's colour, which
    /// page is showing. Written in batches, and never worth a backup.
    Runtime,
}

/// Why the profile on disk could not be used, for the interface to show.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadFailure {
    /// What the parser said.
    pub reason: String,
    /// Where the unreadable file was kept, empty if even that failed.
    pub kept_at: String,
}

enum Job {
    Save(Box<Profile>, SaveKind),
    Flush(Sender<()>),
}

/// The writer thread and the way to reach it.
struct Writer {
    tx: Option<Sender<Job>>,
    /// The last thing that went wrong while writing, for the interface.
    error: Arc<Mutex<Option<String>>>,
    thread: Option<JoinHandle<()>>,
}

impl Writer {
    fn new(path: PathBuf) -> Writer {
        let (tx, rx) = unbounded::<Job>();
        let error = Arc::new(Mutex::new(None));
        let slot = error.clone();
        let thread = std::thread::Builder::new()
            .name("lunchpad-profile-write".into())
            .spawn(move || write_loop(&path, rx, &slot))
            .map_err(|e| tracing::error!(error = %e, "profile writer thread could not start"))
            .ok();
        Writer { tx: Some(tx), error, thread }
    }

    fn send(&self, job: Job) -> ProfileResult<()> {
        match &self.tx {
            Some(tx) => tx.send(job).map_err(|_| ProfileError::Write("the profile writer stopped".into())),
            None => Err(ProfileError::Write("the profile writer stopped".into())),
        }
    }
}

impl Drop for Writer {
    fn drop(&mut self) {
        // Dropping the sender ends the loop, which writes what is still pending.
        self.tx = None;
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}

fn write_loop(path: &Path, rx: Receiver<Job>, error: &Mutex<Option<String>>) {
    let mut pending: Option<(Box<Profile>, SaveKind)> = None;
    let mut oldest = Instant::now();
    loop {
        let job = match &pending {
            None => rx.recv().ok(),
            Some(_) => match rx.recv_timeout(COALESCE.min(MAX_DELAY.saturating_sub(oldest.elapsed()))) {
                Ok(job) => Some(job),
                Err(RecvTimeoutError::Timeout) => {
                    write_pending(path, &mut pending, error);
                    continue;
                }
                Err(RecvTimeoutError::Disconnected) => None,
            },
        };
        match job {
            Some(Job::Save(profile, kind)) => {
                // An edit still waiting keeps its backup even when macro-driven
                // changes follow before the batch reaches the disk.
                let kind = match &pending {
                    Some((_, SaveKind::Edit)) => SaveKind::Edit,
                    _ => kind,
                };
                if pending.is_none() {
                    oldest = Instant::now();
                }
                pending = Some((profile, kind));
                if kind == SaveKind::Edit {
                    write_pending(path, &mut pending, error);
                }
            }
            Some(Job::Flush(reply)) => {
                write_pending(path, &mut pending, error);
                let _ = reply.send(());
            }
            None => {
                write_pending(path, &mut pending, error);
                break;
            }
        }
    }
    tracing::debug!("profile writer thread finished");
}

fn write_pending(path: &Path, pending: &mut Option<(Box<Profile>, SaveKind)>, error: &Mutex<Option<String>>) {
    let Some((profile, kind)) = pending.take() else { return };
    match write_profile(path, &profile, kind) {
        Ok(()) => *error.lock() = None,
        Err(e) => {
            tracing::warn!(path = %path.display(), error = %e, "the profile could not be written");
            *error.lock() = Some(e.to_string());
        }
    }
}

/// One atomic write, with the backup taken first when this is an edit.
fn write_profile(path: &Path, profile: &Profile, kind: SaveKind) -> ProfileResult<()> {
    let parent = path.parent().ok_or_else(|| ProfileError::Write("no parent dir".into()))?;
    fs::create_dir_all(parent).map_err(|e| ProfileError::Write(e.to_string()))?;
    let json = serde_json::to_string_pretty(profile).map_err(|e| ProfileError::Write(e.to_string()))?;
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, json).map_err(|e| ProfileError::Write(e.to_string()))?;
    if kind == SaveKind::Edit && path.exists() {
        let _ = fs::copy(path, path.with_extension("json.bak"));
    }
    fs::rename(&tmp, path).map_err(|e| ProfileError::Write(e.to_string()))?;
    Ok(())
}

/// Waits for the writer without needing the profile lock.
#[derive(Clone)]
pub struct Flusher {
    tx: Option<Sender<Job>>,
}

impl Flusher {
    pub fn flush(&self) {
        let (tx, rx) = bounded(0);
        if let Some(jobs) = &self.tx {
            if jobs.send(Job::Flush(tx)).is_ok() {
                let _ = rx.recv();
            }
        }
    }
}

pub struct ProfileStore {
    path: PathBuf,
    pub profile: Profile,
    writer: Writer,
    /// Set when the file could not be read at start-up, so the interface can
    /// say so instead of quietly showing an empty grid.
    load_failure: Option<LoadFailure>,
}

impl ProfileStore {
    pub fn load(config_dir: &Path) -> Self {
        let path = config_dir.join("profile.json");
        let mut load_failure = None;
        let profile = match fs::read_to_string(&path) {
            Ok(contents) => match serde_json::from_str::<Profile>(&contents) {
                Ok(mut p) => {
                    p.normalize();
                    p
                }
                Err(e) => {
                    let kept = path.with_extension("json.unreadable");
                    tracing::error!(path = %path.display(), error = %e, "profile unreadable; starting empty (a copy is kept)");
                    let kept_at = match fs::copy(&path, &kept) {
                        Ok(_) => kept.display().to_string(),
                        Err(e) => {
                            tracing::warn!(error = %e, "the unreadable profile could not be copied");
                            String::new()
                        }
                    };
                    load_failure = Some(LoadFailure { reason: e.to_string(), kept_at });
                    Profile::default()
                }
            },
            Err(_) => {
                tracing::info!(path = %path.display(), "no profile yet, creating default");
                Profile::default()
            }
        };
        let store = ProfileStore { writer: Writer::new(path.clone()), path, profile, load_failure };
        if !store.path.exists() {
            if let Err(e) = store.save(SaveKind::Edit) {
                tracing::warn!(error = %e, "could not write the initial profile");
            }
            store.flush();
        }
        store
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    /// Why the profile on disk was not used, if it was not.
    pub fn load_failure(&self) -> Option<&LoadFailure> {
        self.load_failure.as_ref()
    }

    /// The profile was read again (a restore), so the old complaint is stale.
    pub fn clear_load_failure(&mut self) {
        self.load_failure = None;
    }

    /// The last write that failed, if the most recent one did.
    pub fn save_error(&self) -> Option<String> {
        self.writer.error.lock().clone()
    }

    /// Hand the profile to the writer. An edit reaches the disk at once, the
    /// state a macro changed within [`MAX_DELAY`].
    pub fn save(&self, kind: SaveKind) -> ProfileResult<()> {
        self.writer.send(Job::Save(Box::new(self.profile.clone()), kind))
    }

    /// Wait until everything queued so far has been written.
    pub fn flush(&self) {
        self.flusher().flush();
    }

    /// A way to wait for the writer that does not need the profile lock, so a
    /// caller can let go of it first.
    pub fn flusher(&self) -> Flusher {
        Flusher { tx: self.writer.tx.clone() }
    }

    /// Replace the profile with the backup, if any.
    pub fn restore_backup(&mut self) -> ProfileResult<()> {
        let bak = self.path.with_extension("json.bak");
        let contents = fs::read_to_string(&bak).map_err(|e| ProfileError::Read(e.to_string()))?;
        let mut profile: Profile = serde_json::from_str(&contents).map_err(|e| ProfileError::Read(e.to_string()))?;
        profile.normalize();
        self.profile = profile;
        self.load_failure = None;
        self.save(SaveKind::Edit)?;
        self.flush();
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::profile::model::{Button, Page};

    fn dir() -> PathBuf {
        std::env::temp_dir().join(format!("lunchpad-test-{}", uuid::Uuid::new_v4()))
    }

    #[test]
    fn save_creates_backup_and_restores() {
        let dir = dir();
        let mut store = ProfileStore::load(&dir);
        store.save(SaveKind::Edit).unwrap();
        store.profile.pages.push(Page::new("second", "Second"));
        store.profile.pages[0].set(1, 1, Button::default());
        store.save(SaveKind::Edit).unwrap();
        store.flush();
        assert!(dir.join("profile.json.bak").exists());
        store.restore_backup().unwrap();
        assert_eq!(store.profile.pages.len(), 1);
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn macro_state_is_written_without_touching_the_backup() {
        let dir = dir();
        let mut store = ProfileStore::load(&dir);
        store.profile.pages.push(Page::new("second", "Second"));
        store.save(SaveKind::Edit).unwrap();
        store.flush();
        let arranged = fs::read_to_string(dir.join("profile.json")).unwrap();
        let backup = fs::read_to_string(dir.join("profile.json.bak")).unwrap();

        // What a knob or a colour-setting loop produces, over and over.
        for i in 0..200 {
            store.profile.pages[0].set(0, 0, Button { loop_down: i % 2 == 0, ..Default::default() });
            store.save(SaveKind::Runtime).unwrap();
        }
        store.flush();

        let on_disk = fs::read_to_string(dir.join("profile.json")).unwrap();
        assert_ne!(on_disk, arranged, "the newest state is on disk");
        assert_eq!(fs::read_to_string(dir.join("profile.json.bak")).unwrap(), backup, "the backup is untouched by what a macro changes");
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn a_burst_of_macro_changes_is_written_once() {
        let dir = dir();
        let mut store = ProfileStore::load(&dir);
        store.flush();
        let written = || fs::metadata(dir.join("profile.json")).and_then(|m| m.modified()).unwrap();
        let before = written();
        // Far enough apart for the file system's timestamp to move if each
        // save went to disk on its own, close enough to land in one batch.
        for i in 0..20 {
            store.profile.pages[0].set(0, 0, Button { loop_down: i % 2 == 0, ..Default::default() });
            store.save(SaveKind::Runtime).unwrap();
            std::thread::sleep(Duration::from_millis(5));
        }
        assert_eq!(written(), before, "nothing is written while the changes keep coming");
        store.flush();
        assert_ne!(written(), before, "the batch lands on flush");
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn an_unreadable_profile_is_kept_and_reported() {
        let dir = dir();
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("profile.json"), r#"{"version":1,"pages":[{"id":"a"#).unwrap();
        let store = ProfileStore::load(&dir);
        let failure = store.load_failure().expect("the failure is reported");
        assert!(!failure.reason.is_empty());
        assert!(dir.join("profile.json.unreadable").exists(), "the file is kept");
        assert_eq!(failure.kept_at, dir.join("profile.json.unreadable").display().to_string());
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn macro_state_never_overwrites_the_backup_of_an_unreadable_profile() {
        let dir = dir();
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("profile.json.bak"), r#"{"version":1,"activePage":"default","pages":[{"id":"default","name":"Mine","buttons":[],"faders":[]}]}"#).unwrap();
        fs::write(dir.join("profile.json"), "{ not json").unwrap();
        let mut store = ProfileStore::load(&dir);
        // The empty default the app starts with, as a running macro would save it.
        store.profile.pages[0].set(0, 0, Button::default());
        store.save(SaveKind::Runtime).unwrap();
        store.flush();
        let backup = fs::read_to_string(dir.join("profile.json.bak")).unwrap();
        assert!(backup.contains("Mine"), "the backup still holds the user's pages");
        store.restore_backup().unwrap();
        assert_eq!(store.profile.pages[0].name, "Mine");
        assert!(store.load_failure().is_none(), "restoring clears the complaint");
        let _ = fs::remove_dir_all(dir);
    }
}
