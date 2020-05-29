import { EventEmitter } from 'events'
import React, { useEffect, useState, useContext } from 'react';
import WebMidi, { Input, Output } from 'webmidi';

import { settingsLabels } from '@lunchpad/types';
import { useSettings } from '@lunchpad/hooks';

export interface IMidiContext {
  input: false | Input
  output: false | Output
  emitter: MidiEvents
  onButtonPressed: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>, note: number) => void
}

const CONTROL_CHANGE = 0xB0;
/* const NOTE_ON = 0x80; */
const NOTE_OFF = 0x90;
const POLY_AFTERTOUCH = 0xA0;

const midiContext = React.createContext<Partial<IMidiContext>>({})
const { Provider } = midiContext;

declare interface MidiEvents {
  on(event: 'ButtonPressed', listener: (note: number, sw: boolean) => void): this;
  on(event: 'ButtonReleased', listener: (note: number) => void): this;
}
class MidiEvents extends EventEmitter {}

const MidiProvider = ({ children }) => {
  //const { activePage, setButton } = useContext(Layout.Context);
  const [ controller ] = useSettings(settingsLabels.controller, "");
  const [ emitter, setEmitter ] = React.useState(new MidiEvents());
  const [ input, setInput ] = useState<false | Input>();
  const [ output, setOutput ] = useState<false | Output>();
console.log(input, output)
  //const Launchpad = Object.keys(Devices).map(k => Devices[k]).filter(d => d.Name === controller).pop();
  
  useEffect(() => {
    WebMidi.enable((err) => {
      if (err) return console.error(err);
      setInput(WebMidi.getInputByName(controller));
      setOutput(WebMidi.getOutputByName(controller))
    }, true);

    return () => {
      WebMidi.disable();
    }
  }, [ controller ])

  useEffect(() => {
    if (!input) return;

    const messageHandler = (event) => {
      const [ msg, note, value] = event.data;
      
      //const [x,y] = Launchpad.ButtonToXY(note);
      if (msg === NOTE_OFF) {
        if (value === 0) {
          emitter.emit('ButtonReleased', note)
          //buttonReleased(x, y, note);
        } else if ( value >= 25) {
          emitter.emit('ButtonPressed', note, false)
          //buttonPressed(x, y, note);
        }
      } else if (msg === CONTROL_CHANGE) {
        if (value) {
          emitter.emit('ButtonPressed', note, false)
          //buttonPressed(x, y, note);
        } else {
          emitter.emit('ButtonReleased', note)
          //buttonReleased(x, y, note);
        }
      } else if (msg === POLY_AFTERTOUCH) {
        if (value > 50) {
          emitter.emit('ButtonPressed', note, false)
          //buttonPressed(x, y, note);
        } else if (value === 0) {
          emitter.emit('ButtonReleased', note)
          //buttonReleased(x, y, note);
        }
      }
    }
    
    input.addListener("midimessage", "all", messageHandler);
    
    return () => {
      if (input) input.removeListener("midimessage", "all", messageHandler);
    }

  }, [ input, output, emitter /* setButton */, /* activePage */ ])

  useEffect(() => {
    if(!output) return;
    //const Launchpad = Object.keys(Devices).map(k => Devices[k]).filter(d => d.Name === "Launchpad MK2").pop();
    // If there is a Mode switch switch it first
    //if (Launchpad.Mode) output.sendSysex([...Launchpad.Vendor], [...Launchpad.Mode]);

    // build colors
    /* const colors = flatten(Object.keys(activePage.buttons).map(x => {
      return Object.keys(activePage.buttons[x]).map(y => {
        const { r, g, b } = activePage.buttons[parseInt(x)][parseInt(y)].color;
        return [Launchpad.XYToButton(parseInt(x),parseInt(y)), r, g, b]
      })
    })) */
    //send one sysex to change the board
    //output.sendSysex([...Launchpad.Vendor], [...Launchpad.Color, ...colors]);
  }) //, [ output, activePage])
  
  const onButtonPressed = (event, note) => {
    // Clicks wont get looped sounds etc
    emitter.emit('ButtonPressed', note, true);
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
  //useModal
}








