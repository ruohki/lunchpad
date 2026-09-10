//! Pages and buttons ("the profile"): what each pad shows and does.

pub mod legacy;
pub mod model;
pub mod service;

pub mod store;

pub use model::*;
pub use service::{mutate, SharedProfile};
pub use store::ProfileStore;
