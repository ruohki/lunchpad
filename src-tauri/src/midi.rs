
use midir::{Ignore, MidiInput, MidiInputConnection, MidiOutput, MidiOutputConnection};
use tokio::{sync::oneshot, time::timeout};
use std::{fmt, sync::{Arc, Mutex}, time::Duration};

use crate::{launchpads::{Launchpad, LaunchpadType}, state::{ConnectionInfo, ConnectionInfoState}};

#[derive(Debug)]
enum DeviceCreationError {
  IndexOutOfBound,
  ErrorOpeningDevice
}

impl std::error::Error for DeviceCreationError {}

impl fmt::Display for DeviceCreationError {
  fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
    match self {
      DeviceCreationError::IndexOutOfBound => write!(f, "Index out of bounds"),
      DeviceCreationError::ErrorOpeningDevice => write!(f, "Cannot connect device"),
    }
  }
}


#[derive(Clone, Debug, serde::Serialize)]
pub struct Device {
  pub idx: usize,
  pub name: String
}

#[derive(Clone, serde::Serialize)]
pub struct DeviceListing {
  input: Vec<Device>,
  output: Vec<Device>
}

#[derive(Default)]
pub struct Connection{
  pub input: Mutex<Option<MidiInputConnection<()>>>,
  pub output: Mutex<Option<MidiOutputConnection>>
}

pub fn input_from_idx(idx: usize) -> Option<Device> {
  let mut midi_in = MidiInput::new("Lunchpad input device").unwrap();
  midi_in.ignore(Ignore::None);

  let in_ports = midi_in.ports();
  if let Some(in_port) = in_ports.get(idx) {
    let name = midi_in.port_name(in_port).unwrap();
    return Some(Device { idx, name })
  }

  None
}

pub fn output_from_idx(idx: usize) -> Option<Device> {
  let midi_out = MidiOutput::new("Lunchpad output device").unwrap();

  let out_ports = midi_out.ports();
  if let Some(out_port) = out_ports.get(idx) {
    let name = midi_out.port_name(out_port).unwrap();
    return Some(Device { idx, name })
  }

  None
}

/// Creates a connection to a midi input device
fn connect_input(idx: usize, callback: Box<dyn Fn(&[u8]) + Send>) -> Result<MidiInputConnection<()>, DeviceCreationError> {
  let mut midi_in = MidiInput::new("Lunchpad input device").unwrap();
  midi_in.ignore(Ignore::None);

  let in_ports = midi_in.ports();
  let in_port = match in_ports.get(idx) {
    Some(port) => port,
    None => {
      return Err(DeviceCreationError::IndexOutOfBound);
    }
  };

  match midi_in.connect(in_port, "lunchpad-input", move |_, message, _| {
    callback(message);
  }, ()) {
    Ok(connection) => return Ok(connection),
    Err(_) => return Err(DeviceCreationError::ErrorOpeningDevice)
  };
}

fn connect_output(idx: usize) -> Result<MidiOutputConnection, DeviceCreationError> {
  let midi_out = MidiOutput::new("Lunchpad output device").unwrap();

  let out_ports = midi_out.ports();
  let out_port = match out_ports.get(idx) {
    Some(port) => port,
    None => {
      return Err(DeviceCreationError::IndexOutOfBound);
    }
  };

  match midi_out.connect(out_port, "lunchpad-input") {
    Ok(connection) => return Ok(connection),
    Err(_) => return Err(DeviceCreationError::ErrorOpeningDevice)
  };
}

async fn identify_device(input_idx: usize, output_idx: usize) -> LaunchpadType {
  let (sender, receiver) = oneshot::channel::<LaunchpadType>();
  let stx = Arc::new(Mutex::new(Some(sender)));

  let mut output = match connect_output(output_idx) {
    Ok(connection) => {
      println!("Output connected");
      connection
    },
    Err(err) => return LaunchpadType::Unknown
  };

  // First callback to listen for the device inquiry to identify the device
  let _input = match connect_input(input_idx, Box::new(move | msg | {
    println!("Msg: {:?}", msg);
    let sender = stx.lock().unwrap().take().unwrap();
    let launchpad_type = Launchpad::identify_device(msg);
    sender.send(launchpad_type).unwrap();
  })) {
    Ok(connection) => {
      println!("Input connected");
      connection
    },
    Err(err) => return LaunchpadType::Unknown
  };

  // Send Device Inquiry
  println!("Sending: {:?}", &Launchpad::device_inquiry().to_vec());
  output.send(&Launchpad::device_inquiry().to_vec()).unwrap();

  // If there is no answer after 1sec its most likely not a launchpad
  let launchpad_type = match timeout(Duration::from_millis(250), receiver).await {
    Ok(v) => v.unwrap(),
    Err(_) => LaunchpadType::Unknown,
  };

  // Boilerplate work for launchpad initialization (mode switch to programmer)
  println!("Connected Launchpad seems to be a: {:?}", launchpad_type);

  launchpad_type
}

#[tauri::command]
pub async fn connect(
  connection_info: tauri::State<'_, ConnectionInfoState>,
  input_idx: usize,
  output_idx: usize
) -> Result<LaunchpadType, String> {
  let launchpad_type = identify_device(input_idx, output_idx).await;
  
  match launchpad_type {
    LaunchpadType::Unknown => return Err("Device does not seem to a Launchpad or is in a dirty state, try reconnecting the Launchpad!".to_string()),
    LaunchpadType::Legacy |
    LaunchpadType::S |
    LaunchpadType::MarkTwo |
    LaunchpadType::ProMarkTwo |
    LaunchpadType::MiniMarkThree |
    LaunchpadType::X |
    LaunchpadType::ProMarkThree => {
      // Setup Info state about the device
      *connection_info.0.lock().unwrap() = Some(ConnectionInfo {
        input: input_from_idx(input_idx).unwrap(),
        output: output_from_idx(output_idx).unwrap(),
        launchpad_type
      });
      
      // Connect & Outputs

      // Send Init sequence
      // let launchpad_data = Launchpad::new(launchpad_type);
      // output.send(&launchpad_data.init_sequence).unwrap();

      
      Ok(launchpad_type)
    },
  }
}

#[tauri::command]
pub fn disconnect(
  connection: tauri::State<Connection>
) {  
  match connection.input.lock().unwrap().take() {
    None => println!("No connection to close"),
    Some(conn) => {
      conn.close();
    },
  } 
}

#[tauri::command]
pub fn list_devices() -> DeviceListing {
  let mut midi_in = MidiInput::new("Lunchpad MIDI Input").unwrap();
  let midi_out = MidiOutput::new("Lunchpad MIDI Output").unwrap();
  midi_in.ignore(Ignore::None);
  
  let in_ports = midi_in.ports();
  let out_ports = midi_out.ports();

  let mut inputs: Vec<Device> = Vec::new();
  let mut outputs: Vec<Device> = Vec::new();

  for (i, p) in in_ports.iter().enumerate() {
    inputs.push(Device {
      idx: i,
      name: midi_in.port_name(p).unwrap()
    });
  }

  for (i, p) in out_ports.iter().enumerate() {
    outputs.push(Device {
      idx: i,
      name: midi_out.port_name(p).unwrap()
    });
  }

  let result: DeviceListing = DeviceListing {
    input: inputs,
    output: outputs,
  };

  result
}