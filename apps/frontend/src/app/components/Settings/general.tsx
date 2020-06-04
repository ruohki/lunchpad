import React, { useContext } from 'react'
import isEmpty from 'lodash/isEmpty';

import { useSettings, useMidiDevices } from '@lunchpad/hooks';
import { AudioContext } from '@lunchpad/contexts'
import { settingsLabels as settings, ControllerType } from '@lunchpad/types'
import { Split, Child, Select, Switch } from '@lunchpad/base';
import { Divider, Row } from './components';

import * as Devices from '@lunchpad/controller';

import KeyCapture from '../KeyCapture';

export default () => {
  const midiDevices = useMidiDevices();
  
  const { outputDevices } = useContext(AudioContext.Context)

  const [ mode, _saveMode ] = useSettings(settings.mode, ControllerType.Software);
  
  const [ controller, setController ] = useSettings(settings.controller, "Software6x6");
  const [ midiInput, setMidiInput ] = useSettings(settings.midiInput, "");
  const [ midiOutput, setMidiOutput ] = useSettings(settings.midiOutput, "");
  
  const [ output, saveOutput ] = useSettings(settings.soundOutput, "default");
  
  const [ ptt, savePtt ] = useSettings(settings.ptt.label, "off");
  const [ pttMouse, savePttMouse ] = useSettings(settings.ptt.mouse, "mouse4");
  //const [ pttKeyboard, savePttKeyboard ] = useSettings(settings.ptt.keyboard, "[]");
  
  const [ logRocket, setLogRocket ] = useSettings(settings.debug.lockRocket, false);

  const saveMode = mode => {
    if (mode === ControllerType.Software) setController("Software6x6")
    else if (mode === ControllerType.Launchpad) setController("LaunchpadMK2")

    _saveMode(mode)
  }
/*   React.useEffect(() => {
    console.log(midiDevices, controller, mode)
    if (!controller && mode === "midi" && outputDevices.length > 0) {
      setController(midiDevices.inputs[0].name)
    }
  }, [outputDevices, controller, mode]) */
  console.log(Devices)
  return (
    <Child grow>
      <Row title="Mode">
        <Select
          value={mode}
          onChange={e => saveMode(e.target.value)}
        >
          <option value={ControllerType.Software}>Software Only</option>
          <option value={ControllerType.Launchpad}>Launchpad</option>
        </Select>
      </Row>
      <Split padding="1rem 1rem 0 1rem">
        <Child basis="0">
          <Divider />
        </Child>
      </Split>
      {mode === ControllerType.Launchpad && (
        <>
          <Row title="Launchpad">
            <Select
              value={controller}
              onChange={e => setController(e.target.value)}
            >
              {!controller && <option>Please select your Launchpad</option>}
              {Object.keys(Devices).map(k => Devices[k].type === ControllerType.Launchpad ? <option key={Devices[k].name} value={k}>{Devices[k].name}</option> : '' )}
            </Select>
          </Row>
          <Row title="MIDI Input">
            <Select
              value={midiInput}
              onChange={e => setMidiInput(e.target.value)}
            >
              {!midiInput && <option>Please select the target midi Input</option>}
              {midiDevices.inputs.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </Select>
          </Row>
          <Row title="MIDI Output">
            <Select
              value={midiOutput}
              onChange={e => setMidiOutput(e.target.value)}
            >
              {!midiOutput && <option>Please select the target midi Output</option>}
              {midiDevices.outputs.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </Select>
          </Row>
        </>
      )}
      {mode === ControllerType.Software && (
        <Row title="Software Layout">
          <Select
            value={controller}
            onChange={e => setController(e.target.value)}
          >
            <option value="Software6x6">Small (6x6)</option>
            <option value="Software9x9">Big (9x9)</option>
          </Select>
        </Row>
      )}
      <Split padding="1rem 1rem 0 1rem">
        <Child basis="0">
          <Divider />
        </Child>
      </Split>
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
      {/* <Row title="Push-to-talk">
        <Select
          value={ptt}
          onChange={e => savePtt(e.target.value)}
        >
          <option value="off">Dont use Push-to-talk</option>
          <option value="mouse">Use mouse button</option>
          <option value="keyboard">Use keyboard</option>
        </Select>
      </Row> */}
      {/* {ptt === "mouse" && (
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
      )} */}
      {/* {ptt === "keyboard" && (
        <Row title="Keyboard">
          <KeyCapture
            value={JSON.parse(pttKeyboard)}
            onChange={(e) => savePttKeyboard((JSON.stringify(e) as string))}
          />
        </Row>
      )} */}
      <Row title="">
        <Split direction="row">
          <Child padding="0 1rem 0 0">
            <Switch
              value={!!logRocket}
              onChange={setLogRocket}
            />
          </Child>
          <Child grow>
            <span>Send anonymous metrics</span>
          </Child>
        </Split>
        
      </Row>
    </Child>
  )
};