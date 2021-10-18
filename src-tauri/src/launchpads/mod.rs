use serde::{Serialize, Deserialize};
mod legacy;
mod mark2;
mod mark3;

#[warn(non_upper_case_globals)]
static SYSEX_START: [u8; 1] = [0xf0];
static SYSEX_END: [u8; 1] = [0xf7];
static NOVATION_HEADER: [u8; 3] = [0x0, 0x20, 0x29];

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum LaunchpadType {
  Unknown = 0x0,
  Legacy = 0xff,
  S = 0x20,
  MarkTwo = 0x69,
  ProMarkTwo = 0x51,
  MiniMarkThree = 0x13,
  X = 0x03,
  ProMarkThree = 0x23,
}

#[derive(Debug)]
pub struct Launchpad {
  pub model: LaunchpadType,
  pub init_sequence: Vec<u8>,
  pub unload_sequence: Vec<u8>,
}

impl Launchpad {
  pub fn new(launchpad_type: LaunchpadType) -> Self {
    match launchpad_type {
        LaunchpadType::Unknown => todo!(),
        LaunchpadType::Legacy => todo!(),
        LaunchpadType::S => todo!(),
        LaunchpadType::MarkTwo => Launchpad { 
          model: LaunchpadType::MarkTwo,
          init_sequence: [
            SYSEX_START.to_vec(),
            NOVATION_HEADER.to_vec(),
            mark2::LPMK2_MODE.to_vec(),
            SYSEX_END.to_vec()
          ].concat(),
          unload_sequence: [
            SYSEX_START.to_vec(),
            NOVATION_HEADER.to_vec(),
            mark2::LPMK2_MODE.to_vec(),
            SYSEX_END.to_vec()
          ].concat(),
        },
        LaunchpadType::ProMarkTwo => todo!(),
        LaunchpadType::MiniMarkThree => Launchpad { 
          model: LaunchpadType::MiniMarkThree,
          init_sequence: [
            SYSEX_START.to_vec(),
            NOVATION_HEADER.to_vec(),
            mark3::MINIMK3_MODE.to_vec(),
            SYSEX_END.to_vec()
          ].concat(),
          unload_sequence: [
            SYSEX_START.to_vec(),
            NOVATION_HEADER.to_vec(),
            mark3::MINIMK3_UNLOAD.to_vec(),
            SYSEX_END.to_vec()
          ].concat(),
        },
        LaunchpadType::X => Launchpad { 
          model: LaunchpadType::MarkTwo,
          init_sequence: [
            SYSEX_START.to_vec(),
            NOVATION_HEADER.to_vec(),
            mark3::LPX_MODE.to_vec(),
            NOVATION_HEADER.to_vec(),
            mark3::LPX_LAYOUT.to_vec(),
            SYSEX_END.to_vec()
          ].concat(),
          unload_sequence: [
            SYSEX_START.to_vec(),
            NOVATION_HEADER.to_vec(),
            mark3::LPX_MODE.to_vec(),
            SYSEX_END.to_vec()
          ].concat(),
        },
        LaunchpadType::ProMarkThree => todo!(),
    }
  }

  pub fn device_inquiry() -> Vec<u8> {
    vec![0xf0u8, 0x7e, 0x7f, 0x06, 0x01, 0xf7]
  }

  pub fn identify_device(data: &[u8]) -> LaunchpadType {
    if data.len() > 8 && data[0] == 0xF0 {
      match data[8] {
        0x13 => LaunchpadType::MiniMarkThree,
        0x69 => LaunchpadType::MarkTwo,
        0x51 => LaunchpadType::ProMarkTwo,
        0x03 => LaunchpadType::X,
        0x23 => LaunchpadType::ProMarkThree,
        0x20 => LaunchpadType::S, 
        0xFF => LaunchpadType::Legacy, //TODO Find out the actual number for legacy pads (Mini and other ones i dont have :D)
        _ => LaunchpadType::Unknown,
      }
    } else {
      LaunchpadType::Unknown
    }
  }
}
