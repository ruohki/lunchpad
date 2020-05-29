import * as React from 'react';
import { useInterval } from 'react-use';
import WebMidi from "webmidi";

/*
0: Input
connection: (...)
id: (...)
manufacturer: (...)
name: (...)
state: (...)
type: (...)
*/

export const useMidiDevices = () => {
  const [ availableDevices, setAvailableDevices ] = React.useState({ inputs: WebMidi.inputs , outputs: WebMidi.outputs });

  const update = React.useCallback(() => {
    const inputs = WebMidi.inputs //.filter(i => i.manufacturer === "Focusrite-Novation" && i.state === "connected");
    const outputs = WebMidi.outputs //.filter(i => i.manufacturer === "Focusrite-Novation" && i.state === "connected");

    setAvailableDevices({
      inputs,
      outputs
    });
  }, []);

  useInterval(update, 500);

  return availableDevices
}

export default useMidiDevices;
