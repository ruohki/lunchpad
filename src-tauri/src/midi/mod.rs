//! MIDI subsystem: device discovery, Launchpad drivers and the live connection.

pub mod inquiry;
pub mod manager;
pub mod models;
pub mod palette;
pub mod render;
pub mod scan;
pub mod types;

pub use manager::*;
pub use types::*;
