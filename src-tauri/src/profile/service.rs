//! Shared "mutate the profile" helper used by commands and the macro engine:
//! apply a change, persist it, and hand back the new profile for broadcasting.

use super::model::Profile;
use super::store::{ProfileError, ProfileStore, SaveKind};
use parking_lot::Mutex;
use std::sync::Arc;

pub type SharedProfile = Arc<Mutex<ProfileStore>>;

/// Apply `f`, normalise, save. Returns the closure's result together with a
/// clone of the profile to emit to the UI. The lock is released before the
/// file is touched, so a write never holds up the LED renderer or a running
/// macro; an edit is waited for, macro-driven state is left to the writer to
/// batch (see [`super::store`]).
pub fn mutate<T>(store: &SharedProfile, kind: SaveKind, f: impl FnOnce(&mut Profile) -> Result<T, ProfileError>) -> Result<(T, Profile), ProfileError> {
    let (out, profile, flusher) = {
        let mut guard = store.lock();
        let out = f(&mut guard.profile)?;
        guard.profile.normalize();
        guard.save(kind)?;
        (out, guard.profile.clone(), guard.flusher())
    };
    if kind == SaveKind::Edit {
        flusher.flush();
    }
    Ok((out, profile))
}
