import React, { useContext } from 'react'

import { useLocalStorage  } from '@rehooks/local-storage';

import { useMidiDevices } from '@lunchpad/hooks';
import { AudioContext } from '@lunchpad/contexts'
import { settingsLabels as settings, ControllerType } from '@lunchpad/types'
import { Split, Child, Select, Switch, KeyboardKeys, Modifiers } from '@lunchpad/base';
import { Divider, Row } from './components';

import * as Devices from '@lunchpad/controller';

import KeyCapture from '../KeyCapture';

export default () => {
  const midiDevices = useMidiDevices();
  
  const { outputDevices } = useContext(AudioContext.Context)

  const [ mode, _saveMode ] = useLocalStorage(settings.mode, ControllerType.Software);
  
  const [ controller, setController ] = useLocalStorage(settings.controller, "Software6x6");
  const [ midiInput, setMidiInput ] = useLocalStorage(settings.midiInput, "");
  const [ midiOutput, setMidiOutput ] = useLocalStorage(settings.midiOutput, "");
  
  const [ output, saveOutput ] = useLocalStorage(settings.soundOutput, "default");
  
  const [ enablePtt, setEnablePtt ] = useLocalStorage<boolean>(settings.ptt.enabled, false);
  const [ pttKey, savePttKey ] = useLocalStorage(settings.ptt.key, "enter");
  const [ pttModifier, savePttModifier ] = useLocalStorage<string[]>(settings.ptt.modifier, []);

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
      <Row title="Push-to-talk">
        <Split direction="row">
          <Child padding="0 1rem 0 0">
            <Switch
              value={enablePtt}
              onChange={setEnablePtt}
            />
          </Child>
          <Child grow>
            <span>Enable or disable Push-To-Talk</span>
          </Child>
        </Split>
      </Row>
      {enablePtt && (
        <Row title="Keyboard">
          <Split direction="row">
            <Child grow padding="0 1rem 0 0">
              <Select value={pttKey} onChange={(e) => savePttKey(e.target.value)}>
                {KeyboardKeys.map(k => <option key={k} value={k}>{k}</option>)}
              </Select>
            </Child>
            <Child grow>
              <Modifiers modifiers={pttModifier} onChange={savePttModifier} />
            </Child>
          </Split>
        </Row>
      )}
    </Child>
  )
};