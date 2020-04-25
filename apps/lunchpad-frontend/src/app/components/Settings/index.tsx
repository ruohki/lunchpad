import React, { useState } from 'react';
import lodash from 'lodash';

import Select from '../Basic/select';

import { Backdrop, Container, Divider } from './components';
import { useInterval, useMediaDevices } from 'react-use';
import { ipcChannels as ipc, settingsLabels as settings } from '@lunchpad/types';
import { useSettings } from '../../hooks/useSettings';

type MediaDevice = {
  kind: 'audioinpit' | 'audiooutput',
  deviceId: string,
  label: string,
  groupId: string
}

type MediaDevices = {
  devices: MediaDevice[]
}

const { ipcRenderer } = window.require('electron');

const useMidiDevices = () => {
  const [ availableDevices, setAvailableDevices ] = useState([]);
  useInterval(async () => {
    const devices = await ipcRenderer.invoke(ipc.onGetDevices)
    if(!lodash.isEqual(devices.sort(), availableDevices.sort())) setAvailableDevices(devices)
  }, 1000)
  return availableDevices;
}

export default ({ visible }) => {
  const midiDevices = useMidiDevices();
  const mediaDevices = useMediaDevices() as MediaDevices;
  
  const [ controller, setController ] = useSettings(settings.controller);
  const [ output, setOutput ] = useSettings(settings.soundOutput);

  return /* visible ? */ (
    <Backdrop>
      <Container>
        <div>
          <h3>Settings</h3>
        </div>
        <div>
          <div>
            <div>
              MIDI Device
            </div>
            <div>
              <Select
                value={controller}
                onChange={e => setController(e.target.value)}
                disabled={lodash.isEmpty(midiDevices)}
              >
                {lodash.isEmpty(midiDevices) ? (
                  <option>No compatible devices found</option>
                ): (
                  midiDevices.map(d => <option key={d} value={d}>{d}</option>)
                )}
              </Select>
            </div>
          </div>
          <Divider />
          <div>
            <div>
              Sound Output
            </div>
            <div>
              <Select
                value={output}
                onChange={e => setOutput(e.target.value)}
              >
                {lodash.filter(mediaDevices.devices, (e) => e.kind === "audiooutput").map(e => <option key={e.deviceId} value={e.deviceId}>{e.label}</option>)}
              </Select>
            </div>
            </div>
        </div>
        <div>C</div>
      </Container>
    </Backdrop>
  ) /* : (
    <></> 
  ) */
}