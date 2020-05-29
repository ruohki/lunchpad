import React, { useContext } from 'react'
import isEmpty from 'lodash/isEmpty';

import { useSettings, useMidiDevices } from '@lunchpad/hooks';
import { AudioContext } from '@lunchpad/contexts'
import { settingsLabels as settings } from '@lunchpad/types'
import { Split, Child, Select } from '@lunchpad/base';
import { Divider, Row } from './components';


import KeyCapture from '../KeyCapture';

export default () => {
  const midiDevices = useMidiDevices();
  
  const { outputDevices } = useContext(AudioContext.Context)

  const [ mode, saveMode ] = useSettings(settings.mode, "software");
  const [ layout, saveLayout ] = useSettings(settings.software.layout, "small8");
  const [ controller, setController ] = useSettings(settings.controller, "");
  const [ output, saveOutput ] = useSettings(settings.soundOutput, "default");
  
  const [ ptt, savePtt ] = useSettings(settings.ptt.label, "off");
  const [ pttMouse, savePttMouse ] = useSettings(settings.ptt.mouse, "mouse4");
  const [ pttKeyboard, savePttKeyboard ] = useSettings(settings.ptt.keyboard, "[]");
  
  React.useEffect(() => {
    console.log(midiDevices, controller, mode)
    if (!controller && mode === "midi" && outputDevices.length > 0) {
      setController(midiDevices.inputs[0].name)
    }
  }, [outputDevices, controller, mode])
  
  return (
    <Child grow>
      <Row title="Mode">
        <Select
          value={mode}
          onChange={e => saveMode(e.target.value)}
        >
          <option value="software">Software Only</option>
          <option value="midi">MIDI Device</option>
        </Select>
      </Row>
      {mode === "midi" && (
        <Row title="MIDI Device">
          <Select
            value={controller}
            onChange={e => setController(e.target.value)}
            disabled={isEmpty(midiDevices)}
          >
            {isEmpty(midiDevices) ? (
              <option>No compatible devices found</option>
            ): (
              midiDevices.inputs.map(d => <option key={d.id} value={d.name}>{d.name}</option>)
            )}
          </Select>
        </Row>
      )}
      {mode === "software" && (
        <Row title="Software Layout">
          <Select
            value={layout}
            onChange={e => saveLayout(e.target.value)}
          >
            <option value="small4">Small (4x4)</option>
            <option value="small8">Small (4x8)</option>
            <option value="big">Small (8x8)</option>
          </Select>
        </Row>
      )}

      <Row title="Sound Output">
        <Select
          value={output}
          onChange={e => saveOutput(e.target.value)}
        >
          {outputDevices.map(e => <option key={e.deviceId} value={e.deviceId}>{e.label}</option>)}
        </Select>
      </Row>
      <Split padding="1rem 1rem 0 1rem">
        <Child basis="0">
          <Divider />
        </Child>
      </Split>
      <Row title="Push-to-talk">
        <Select
          value={ptt}
          onChange={e => savePtt(e.target.value)}
        >
          <option value="off">Dont use Push-to-talk</option>
          <option value="mouse">Use mouse button</option>
          <option value="keyboard">Use keyboard</option>
        </Select>
      </Row>
      {ptt === "mouse" && (
        <Row title="Mouse Button">
          <Select
            value={pttMouse}
            onChange={e => savePttMouse(e.target.value)}
          >
            <option value="mouse1">Mouse 1 (Left Button)</option>
            <option value="mouse2">Mouse 2 (Right Button)</option>
            <option value="mouse3">Mouse 3 (Middle or Wheel Button)</option>
            <option value="mouse4">Mouse 4 (ex: Thumb Button 1)</option>
            <option value="mouse5">Mouse 5 (ex: Thumb Button 2)</option>
          </Select>
        </Row>
      )}
      {ptt === "keyboard" && (
        <Row title="Keyboard">
          <KeyCapture
            value={JSON.parse(pttKeyboard)}
            onChange={(e) => savePttKeyboard(JSON.stringify(e))}
          />
        </Row>
      )}
    </Child>
  )
};