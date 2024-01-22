#![allow(dead_code)]
use thiserror::Error;


#[derive(Error, Debug)]
pub enum InputDeviceError {
    #[error("Error listing input devices")]
    ListDevicesError,

    #[error("Given index '`{0}`' is out of bounds")]
    IndexOutOfBounds(usize),

    #[error("Device '`{0}`' could not be opened")]
    OpenDeviceError(usize),
}

#[derive(Error, Debug)]
pub enum OutputDeviceError {
    #[error("Error listing output devices")]
    ListDevicesError,

    #[error("Given index '`{0}`' is out of bounds")]
    IndexOutOfBounds(usize),

    #[error("Device '`{0}`' could not be opened")]
    OpenDeviceError(usize),
}
