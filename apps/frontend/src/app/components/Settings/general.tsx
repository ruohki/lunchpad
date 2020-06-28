import React, { useContext } from 'react'

import { useSettings  } from '@lunchpad/hooks';

import { useMidiDevices } from '@lunchpad/hooks';
import { AudioContext, MidiContext } from '@lunchpad/contexts'
import { settingsLabels as settings, ControllerType } from '@lunchpad/types'
import { Split, Child, Select, Switch, Divider, Row } from '@lunchpad/base';

import * as Devices from '../../controller';
import { KeyboardKeys } from '../../actions/hotkey/keys';
import { Modifiers } from '../../actions/hotkey/components/modifiers';

export default () => {
  const midiDevices = useMidiDevices();
  const { inputs, outputs } = React.useContext(MidiContext.Context);

  const { outputDevices } = useContext(AudioContext.Context)

  const [ mode, _saveMode ] = useSettings(settings.mode, ControllerType.Software);
  
  const [ controller, setController ] = useSettings(settings.controller, "Software6x6");
  const [ showIcons, setShowIcons ] = useSettings(settings.icons, true);

  const [ midiInput, setMidiInput ] = useSettings(settings.midiInput, "");
  const [ midiOutput, setMidiOutput ] = useSettings(settings.midiOutput, "");
  
  const [ output, saveOutput ] = useSettings(settings.soundOutput, "default");
  
  const [ enablePtt, setEnablePtt ] = useSettings(settings.ptt.enabled, false);
  const [ pttKey, savePttKey ] = useSettings(settings.ptt.key, "enter");
  const [ pttModifier, savePttModifier ] = useSettings(settings.ptt.modifier, "[]");
  
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
          <Row title="">
            <Split direction="row">
              <Child padding="0 1rem 0 0">
                <Switch
                  value={showIcons === "true"}
                  onChange={val => setShowIcons(`${val}`)}
                />
              </Child>
              <Child grow>
                <span>Show icons on buttons</span>
              </Child>
            </Split>
          </Row>
          <Split padding="1rem 1rem 0 1rem">
            <Child basis="0">
              <Divider />
            </Child>
          </Split>
          <Row title="MIDI Input">
            <Select
              value={midiInput}
              onChange={e => setMidiInput(e.target.value)}
            >
              <option value="">Dont use MIDI input</option>
              {inputs.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </Select>
          </Row>
          <Row title="MIDI Output">
            <Select
              value={midiOutput}
              onChange={e => setMidiOutput(e.target.value)}
            >
              <option value="">Dont use MIDI output</option>
              {outputs.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
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
              value={enablePtt === "true"}
              onChange={val => setEnablePtt(`${val}`)}
            />
          </Child>
          <Child grow>
            <span>Enable or disable Push-To-Talk</span>
          </Child>
        </Split>
      </Row>
      {enablePtt === "true" && (
        <Row title="Keyboard">
          <Split direction="row">
            <Child grow padding="0 1rem 0 0">
              <Select value={pttKey} onChange={(e) => savePttKey(e.target.value)}>
                {KeyboardKeys.map(k => <option key={k} value={k}>{k}</option>)}
              </Select>
            </Child>
            <Child grow>
              <Modifiers modifiers={JSON.parse(pttModifier)} onChange={(mods) => savePttModifier(JSON.stringify(mods))} />
            </Child>
          </Split>
        </Row>
      )}
    </Child>
  )
};