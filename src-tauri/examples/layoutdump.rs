//! Print a model's layout as JSON, for the docs harness (`cargo run --example layoutdump -- LaunchpadProMk3`).
use lunchpad_lib::midi::models::driver_for;
use lunchpad_lib::midi::types::LaunchpadModel;

fn main() {
    let model = std::env::args().nth(1).unwrap_or_else(|| "LaunchpadProMk3".into());
    let model: LaunchpadModel = serde_json::from_value(serde_json::Value::String(model)).expect("model name");
    println!("{}", serde_json::to_string(&driver_for(model).layout()).unwrap());
}
