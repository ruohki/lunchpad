import * as React from "react";
import { EventEmitter } from "events";
import lodash from 'lodash'

import WebMidi, { Input, Output, InputEventMidimessage } from "webmidi";
import { useSettings } from '@lunchpad/hooks';
import { settingsLabels } from '@lunchpad/types';


interface IDevice {
  name: string;
  id: string;
}

interface IPressed {
  note: number;
  cc: boolean;
}

interface IMidiContext {
  openOutput(id: string): void;
  openInput(id: string): void;
  sendSysEx(code: number[], data: number[]): void;

  output: string;
  outputs: Output[];
  currentOutput: (Output | false)

  input: string;
  inputs: Input[];
  currentInput: (Input | false)
  pressed: IPressed[];

  emitter: MidiEmitter;
}

const CONTROL_CHANGE = 0xb0;
const NOTE_OFF = 0x80;
const NOTE_ON = 0x90;
const POLY_AFTERTOUCH = 0xa0;

const midiContext = React.createContext<Partial<IMidiContext>>({});
const Provider = midiContext.Provider;

declare interface MidiEmitter {
  on(
    event: "onButtonDown",
    listener: (note: number, cc: boolean) => void
  ): this;
  on(event: "onButtonUp", listener: (note: number, cc: boolean) => void): this;
}

class MidiEmitter extends EventEmitter {}

let emitter = new MidiEmitter();

export { emitter as MidiEmitter };

const MidiProvider = ({ children }) => {
  const [ input, setInput ] = useSettings(settingsLabels.midiInput, "");
  const [ output, setOutput ] = useSettings(settingsLabels.midiOutput, "");

  const [pressed, setPressed] = React.useState<IPressed[]>([]);

  const [midiInput, setMidiInput] = React.useState<Input | false>();
  const [midiOutput, setMidiOutput] = React.useState<Output | false>();

  React.useEffect(() => { emitter = new MidiEmitter() }, [])

  React.useEffect(() => {
    if (
      (midiInput && midiInput.state === "connected") ||
      (midiOutput && midiOutput.state === "connected")
    ) {
      setMidiInput(false);
      setMidiOutput(false);
      WebMidi.disable();
    }

    WebMidi.enable(err => {
      if (err) return console.error(err);
      setMidiInput(lodash.isEmpty(output) ? false : WebMidi.getInputById(input) || WebMidi.getInputByName(input));
      setMidiOutput(lodash.isEmpty(output) ? false : WebMidi.getOutputById(output) || WebMidi.getOutputByName(output));
    }, true);
    return () => {
      if (WebMidi.enabled) WebMidi.disable();
    };
  }, [input, output]);

  const setButtonUp = React.useCallback((note: number, cc = false) => {
    emitter.emit("onButtonUp", note, cc);
    setPressed(pressed => {
      const index = pressed.findIndex(
        button => button.note === note && button.cc === cc
      );
      pressed.splice(index, 1);
      return [...pressed];
    });
  }, []);

  const setButtonDown = React.useCallback(
    (note: number, cc = false) => {
      emitter.emit("onButtonDown", note, cc);
      setPressed([
        {
          note,
          cc
        },
        ...pressed
      ]);
    },
    [pressed, setPressed]
  );

  // Register Events on target Device
  React.useEffect(() => {
    const midiMessage = (event: InputEventMidimessage) => {
      const [msg, note, value] = Array.from(event.data);

      if (msg === NOTE_ON) {
        if (value === 0) {
          setButtonUp(note, false);
        } else if (value >= 25) {
          setButtonDown(note, false);
        }
      } else if (msg === NOTE_OFF) {
        setButtonUp(note, false);
      } else if (msg === CONTROL_CHANGE) {
        if (value) {
          setButtonDown(note, true);
        } else {
          setButtonUp(note, true);
        }
      } else if (msg === POLY_AFTERTOUCH) {
        if (value > 50) {
          setButtonDown(note, false);
        } else if (value === 0) {
          setButtonUp(note, false);
        }
      }
    };

    if (midiInput) {
      midiInput.removeListener("midimessage", "all", midiMessage);
      midiInput.on("midimessage", "all", midiMessage);
    }
    return () => {
      if (midiInput) {
        midiInput.removeListener("midimessage", "all", midiMessage);
      }
    };
  }, [midiInput, setButtonDown]);

  const sendSysEx = React.useCallback(
    (code: number[], data: number[]) => {
      if (WebMidi.enabled && midiOutput) {
        midiOutput.sendSysex(code, data);
      }
    },
    [midiOutput]
  );
    
  const value = {
    pressed,
    input,
    inputs: WebMidi.inputs,
    currentInput: midiInput,
    output,
    outputs: WebMidi.outputs,
    currentOutput: midiOutput,
    sendSysEx,
    emitter,
    openInput: (id: string) => setInput(id),
    openOutput: (id: string) => setOutput(id)
  };
  return <Provider value={value}>{children}</Provider>;
};

export default {
  Context: midiContext,
  Provider: MidiProvider
};
