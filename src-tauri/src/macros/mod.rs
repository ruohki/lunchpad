//! Macro definitions and the engine that runs them.
//!
//! * `model`  - serializable actions (what a button does)
//! * `engine` - runners, cancellation, cross-button calls, flip-flop state
//! * `sink`   - what the engine reports to the outside (UI events, LEDs, keys)

pub mod builtins;
pub mod engine;
mod exec;
pub mod model;
pub mod services;
pub mod sink;

pub use engine::*;
pub use model::*;
pub use services::Services;
pub use sink::*;
