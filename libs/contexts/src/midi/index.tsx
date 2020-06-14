import { EventEmitter } from 'events'
import React, { useEffect, useState, useContext } from 'react';
import WebMidi, { Input, Output } from 'webmidi';

import { settingsLabels } from '@lunchpad/types';
import { useLocalStorage } from 'react-use';


export interface IMidiContext {
  input: false | Input
  output: false | Output
  emitter: MidiEvents
  onButtonPressed: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>, note: number, cc: boolean) => void
}

const CONTROL_CHANGE = 0xB0;
const NOTE_OFF = 0x80;
const NOTE_ON = 0x90;

const POLY_AFTERTOUCH = 0xA0;

const midiContext = React.createContext<Partial<IMidiContext>>({})
const { Provider } = midiContext;

declare interface MidiEvents {
  on(event: 'ButtonPressed', listener: (note: number, cc: boolean, sw: boolean) => void): this;
  on(event: 'ButtonReleased', listener: (note: number, cc: boolean) => void): this;
}
class MidiEvents extends EventEmitter {}

const MidiProvider = ({ children }) => {
  const [ midiInput ] = useLocalStorage(settingsLabels.midiInput, "");
  const [ midiOutput ] = useLocalStorage(settingsLabels.midiOutput, "");

  const [ emitter, setEmitter ] = React.useState(new MidiEvents());
  const [ input, setInput ] = useState<false | Input>();
  const [ output, setOutput ] = useState<false | Output>();

  useEffect(() => {
    WebMidi.enable((err) => {
      if (err) return console.error(err);
      setInput(WebMidi.getInputByName(midiInput));
      setOutput(WebMidi.getOutputByName(midiOutput))
    }, true);

    return () => {
      WebMidi.disable();
    }
  }, [ midiInput, midiOutput ])

  useEffect(() => {
    if (!input) return;

    const messageHandler = (event) => {
      const [ msg, note, value] = event.data;
      
      if (msg === NOTE_ON) {
        if (value === 0) {
          emitter.emit('ButtonReleased', note, false, false)
        } else if ( value >= 25) {
          emitter.emit('ButtonPressed', note, false, false)
        }
      } else if (msg === NOTE_OFF) {
        emitter.emit('ButtonReleased', note, false, false)
      } else if (msg === CONTROL_CHANGE) {
        if (value) {
          emitter.emit('ButtonPressed', note, true, false)
        } else {
          emitter.emit('ButtonReleased', note, true)
        }
      } else if (msg === POLY_AFTERTOUCH) {
        if (value > 50) {
          emitter.emit('ButtonPressed', note, false, false)
        } else if (value === 0) {
          emitter.emit('ButtonReleased', note, false)
        }
      }
    }
    
    input.addListener("midimessage", "all", messageHandler);
    
    return () => {
      if (input) input.removeListener("midimessage", "all", messageHandler);
    }

  }, [ input, output, emitter /* setButton */, /* activePage */ ])
  
  const onButtonPressed = (event, note, cc = false) => {
    // Clicks wont get looped sounds etc
    emitter.emit('ButtonPressed', note, cc, true);
  }

  return (
    <Provider value={{
      emitter,
      input,
      output,
      onButtonPressed
    }}>
      {children}
    </Provider>
  )
}

export const MidiContext = {
  Provider: MidiProvider,
  Context: midiContext,
}








