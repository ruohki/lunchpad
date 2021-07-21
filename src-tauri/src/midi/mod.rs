use midir::{Ignore, MidiInput, MidiInputConnection, MidiOutput, MidiOutputConnection};
use std::{sync::Mutex, sync::Arc, time::Duration};
use tokio::sync::oneshot;
use tokio::time::timeout;
use std::fmt;

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


#[derive(Clone, serde::Serialize)]
struct Device {
  idx: usize,
  name: String
}

#[derive(Clone, serde::Serialize)]
pub struct DeviceListing {
  input: Vec<Device>,
  output: Vec<Device>
}

#[derive(Debug)]
pub enum LaunchpadType {
  Unknown,
  Legacy,
  MarkTwo,
  ProMarkTwo,
  MiniMarkThree,
  X,
  ProMarkThree
}

#[derive(Default)]
pub struct Connection{
  pub input: Mutex<Option<MidiInputConnection<()>>>,
  pub output: Mutex<Option<MidiOutputConnection>>
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

#[tauri::command]
pub async fn connect(
  connection: tauri::State<'_, Connection>,
  input_idx: usize,
  output_idx: usize
) -> Result<(), String> {
  let (sender, receiver) = oneshot::channel::<LaunchpadType>();
  let stx = Arc::new(Mutex::new(Some(sender)));

  let mut output = match connect_output(output_idx) {
    Ok(connection) => {
      println!("Output connected");
      connection
    },
    Err(err) => return Err(err.to_string())
  };

  // First callback to listen for the device inquiry to identify the device
  let _input = match connect_input(input_idx, Box::new(move | msg | {
    println!("Msg: {:?}", msg);
    if msg[0] == 240 {
      let sender = stx.lock().unwrap().take().unwrap();
      match msg.get(8) {
        Some(id) => {
          let launchpad_type = match id {
            0x13 => LaunchpadType::MiniMarkThree,
            0x69 => LaunchpadType::MarkTwo,
            0x51 => LaunchpadType::ProMarkTwo,
            0x03 => LaunchpadType::X,
            0x23 => LaunchpadType::ProMarkThree,
            0xFF => LaunchpadType::Legacy, //TODO Find out the actual number for legacy pads
            _ => LaunchpadType::Unknown
          };

          sender.send(launchpad_type).unwrap();
        },
        None => todo!(),
      }
    }
  })) {
    Ok(connection) => {
      println!("Input connected");
      connection
    },
    Err(err) => return Err(err.to_string())
  };

  let message = &[0xf0u8, 0x7e, 0x7f, 0x06, 0x01, 0xf7];
  output.send(message).unwrap();

  let launchpad_type = match timeout(Duration::from_millis(1000), receiver).await {
    Ok(v) => v.unwrap(),
    Err(_) => LaunchpadType::Unknown,
  };

  println!("Connected Launchpad seems to be a: {:?}", launchpad_type);
  Ok(())
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