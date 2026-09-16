//! Variables Lunchpad provides to every macro: the press, the page and the
//! clock. Actions cannot write them; the UI colours them apart.

use chrono::{Datelike, Local, Timelike};
use std::collections::HashMap;

/// Every provided name, in the order the UI lists them. Mirrored by
/// `BUILTIN_VARIABLES` in `src/lib/api.ts`.
pub const NAMES: &[&str] = &[
    "velocity", "velocity01", "pressure", "pressure01", "x", "y", "pageId", "pageName", "caption", "date", "time", "datetime", "timestamp", "weekday", "year", "month", "day", "hour", "minute", "second",
];

pub fn is_builtin(name: &str) -> bool {
    NAMES.contains(&name)
}

/// What a press looks like to its actions.
#[derive(Debug, Clone)]
pub struct Press {
    pub velocity: u8,
    pub pressure: u8,
    pub x: u8,
    pub y: u8,
    pub page_id: String,
    pub page_name: String,
    pub caption: String,
}

impl Press {
    /// A stand-in for previews and tests: a full-force press at the origin of the default page.
    pub fn sample() -> Self {
        Press { velocity: 127, pressure: 0, x: 0, y: 0, page_id: "default".into(), page_name: "Default".into(), caption: String::new() }
    }
}

/// The provided variables for a press, the clock read now.
pub fn values(press: &Press) -> HashMap<&'static str, String> {
    let now = Local::now();
    let mut vars: HashMap<&'static str, String> = HashMap::with_capacity(NAMES.len());
    vars.insert("velocity", press.velocity.to_string());
    vars.insert("velocity01", format!("{:.3}", press.velocity as f32 / 127.0));
    vars.insert("pressure", press.pressure.to_string());
    vars.insert("pressure01", format!("{:.3}", press.pressure as f32 / 127.0));
    vars.insert("x", press.x.to_string());
    vars.insert("y", press.y.to_string());
    vars.insert("pageId", press.page_id.clone());
    vars.insert("pageName", press.page_name.clone());
    vars.insert("caption", press.caption.clone());
    vars.insert("date", now.format("%Y-%m-%d").to_string());
    vars.insert("time", now.format("%H:%M").to_string());
    vars.insert("datetime", now.format("%Y-%m-%d %H:%M:%S").to_string());
    vars.insert("timestamp", now.timestamp().to_string());
    vars.insert("weekday", now.format("%A").to_string());
    vars.insert("year", now.year().to_string());
    vars.insert("month", format!("{:02}", now.month()));
    vars.insert("day", format!("{:02}", now.day()));
    vars.insert("hour", format!("{:02}", now.hour()));
    vars.insert("minute", format!("{:02}", now.minute()));
    vars.insert("second", format!("{:02}", now.second()));
    vars
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_name_has_a_value() {
        let vars = values(&Press::sample());
        for name in NAMES {
            assert!(vars.contains_key(name), "{name} missing");
        }
        assert_eq!(vars.len(), NAMES.len());
        assert_eq!(vars["velocity01"], "1.000");
        assert_eq!(vars["date"].len(), 10);
        assert_eq!(vars["time"].len(), 5);
        assert!(is_builtin("date") && !is_builtin("deaths"));
    }
}
