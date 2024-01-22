use std::fmt::{Display, Formatter};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct InputDevice {
    pub idx: usize,
    pub name: String
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct OutputDevice {
    pub idx: usize,
    pub name: String
}

impl Display for InputDevice {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(f, "{} [{}]", self.name, self.idx)
    }
}

impl Display for OutputDevice {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(f, "{} [{}]", self.name, self.idx)
    }
}