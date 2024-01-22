use std::sync::{Arc, Mutex};
use std::time::Duration;
use midir::{Ignore, MidiInput, MidiInputConnection, MidiOutput, MidiOutputConnection};
use crate::midi::error::{InputDeviceError, OutputDeviceError};
use crate::midi::structs::{InputDevice, OutputDevice};
use crossbeam_channel::{after, select, unbounded};
use crate::launchpad::{Launchpad, LaunchpadType};

mod structs;
mod error;
pub mod commands;

pub fn get_input_devices() -> Result<Vec<InputDevice>, ()> {
    let midi_in = MidiInput::new("Lunchpad MIDI Input").unwrap();

    let in_ports = midi_in.ports();
    let mut inputs: Vec<InputDevice> = Vec::new();

    for (i, p) in in_ports.iter().enumerate() {
        inputs.push(InputDevice {
            idx: i,
            name: midi_in.port_name(p).unwrap(),
        });
    }

    Ok(inputs)
}

pub fn get_output_devices() -> Result<Vec<OutputDevice>, ()> {
    let midi_out = MidiOutput::new("Lunchpad MIDI Output").unwrap();
    let out_ports = midi_out.ports();
    let mut outputs: Vec<OutputDevice> = Vec::new();

    for (i, p) in out_ports.iter().enumerate() {
        outputs.push(OutputDevice {
            idx: i,
            name: midi_out.port_name(p).unwrap(),
        });
    }

    Ok(outputs)
}

/// Creates a connection to a midi input device
fn connect_input(idx: usize, callback: Box<dyn Fn(&[u8]) + Send>) -> Result<MidiInputConnection<()>, InputDeviceError> {
    let mut midi_in = MidiInput::new("Lunchpad input device").unwrap();
    midi_in.ignore(Ignore::None);

    let in_ports = midi_in.ports();
    let in_port = match in_ports.get(idx) {
        Some(port) => port,
        None => {
            return Err(InputDeviceError::IndexOutOfBounds(idx));
        }
    };

    return match midi_in.connect(in_port, "lunchpad-input", move |_, message, _| {
        callback(message);
    }, ()) {
        Ok(connection) => Ok(connection),
        Err(_) => Err(InputDeviceError::OpenDeviceError(idx))
    }
}

fn connect_output(idx: usize) -> Result<MidiOutputConnection, OutputDeviceError> {
    let midi_out = MidiOutput::new("Lunchpad output device").unwrap();

    let out_ports = midi_out.ports();
    let out_port = match out_ports.get(idx) {
        Some(port) => port,
        None => {
            return Err(OutputDeviceError::IndexOutOfBounds(idx));
        }
    };

    return match midi_out.connect(out_port, "lunchpad-output") {
        Ok(connection) => Ok(connection),
        Err(_) => Err(OutputDeviceError::OpenDeviceError(idx))
    };
}

pub fn identify_device(input_idx: usize, output_idx: usize) -> LaunchpadType {
    let (sender, receiver) = unbounded::<LaunchpadType>();

    let stx = Arc::new(Mutex::new(Some(sender)));

    let mut output = match connect_output(output_idx) {
        Ok(connection) => {
            //dbg!("Output connected");
            connection
        },
        Err(_) => return LaunchpadType::Unknown
    };

    // First callback to listen for the device inquiry to identify the device
    let _input = match connect_input(input_idx, Box::new(move | msg | {
        /*println!("Msg: {:?}", msg);*/
        let sender = stx.lock().unwrap().take().unwrap();

        let launchpad_type = Launchpad::identify_device(msg);
        sender.send(launchpad_type).unwrap();
    })) {
        Ok(connection) => {
            //dbg!("Input connected");
            connection
        },
        Err(_) => return LaunchpadType::Unknown
    };

    // Send Device Inquiry
    // dbg!("Sending: {:?}", &Launchpad::device_inquiry().to_vec());
    output.send(&Launchpad::device_inquiry().to_vec()).unwrap();

    let timeout = Duration::from_millis(5);

    let launchpad_type = select! {
        recv(receiver) -> launchpad_type => launchpad_type.unwrap(),
        recv(after(timeout)) -> _ => LaunchpadType::Unknown,
    };

    launchpad_type
}