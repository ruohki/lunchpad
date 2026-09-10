//! Shared "mutate the profile" helper used by commands and the macro engine:
//! apply a change, persist it, and hand back the new profile for broadcasting.

use super::model::Profile;
use super::store::{ProfileError, ProfileStore};
use parking_lot::Mutex;
use std::sync::Arc;

pub type SharedProfile = Arc<Mutex<ProfileStore>>;

/// Apply `f`, normalise, save. Returns the closure's result together with a
/// clone of the profile to emit to the UI. The lock is released before return
/// so callers can safely take other locks afterwards.
pub fn mutate<T>(store: &SharedProfile, f: impl FnOnce(&mut Profile) -> Result<T, ProfileError>) -> Result<(T, Profile), ProfileError> {
    let mut guard = store.lock();
    let out = f(&mut guard.profile)?;
    guard.profile.normalize();
    guard.save()?;
    Ok((out, guard.profile.clone()))
}
