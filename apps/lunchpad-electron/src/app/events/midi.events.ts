import * as easymidi from 'easymidi';
import * as lodash from 'lodash';

import App from '../app';

import { ipcMain  } from 'electron';

import { ipcChannels as ipc, Colorspec, BaseColorSpec, SYSEX_COLOR } from '@lunchpad/types'

import LaunchpadBase from '../controllers/launchpadbase';
import LaunchpadX from '../controllers/launchpadx';
import LaunchpadMK2 from '../controllers/launchpadmk2';

import { ButtonState } from '@lunchpad/types'
const AvailableDevices = [
  LaunchpadX,
  LaunchpadMK2
];

const mapToObj = (map) => Array.from(map).reduce((obj, [key, value]) => {
  obj[key] = value;
  return obj;
}, {});

export default class MidiEvents {
  private static input: any;
  private static output: any;

  private static Launchpad: LaunchpadBase;
  
  static boostrapMidiEvents() {
    /* MidiEvents.output = new Midi.output();
    MidiEvents.input = new Midi.input(); */
    ipcMain.handle('ENUM_GET_INPUTS', async (event) => await easymidi.getInputs());
    ipcMain.handle('ENUM_GET_OUTPUTS', async (event) => await easymidi.getOutputs());
    
    /**
     * Will return all supported device names that are connected
     */
    ipcMain.handle(ipc.onGetDevices, async (event) => {
      const ConnectedSupportedDevices: string[] = [];
      
      for(const lp of AvailableDevices) {
        if (lp.IsConnected()) ConnectedSupportedDevices.push(lp.GetName());
      }
      
      return ConnectedSupportedDevices;
    })

    ipcMain.handle(ipc.onActivateDevice, async (event, { device }) => {
      const Launchpad = AvailableDevices.find(d => d.GetName() === device)

      if (!!this.Launchpad && this.Launchpad.GetStatic().GetName() === Launchpad.GetName()) return false; //Error("This Device is already active")
      if (!Launchpad.IsConnected()) return false; //new Error("This Device is not connected")

      if (this.Launchpad) {
        this.Launchpad.Destroy()
      }

      try {
        this.Launchpad = new Launchpad();
        this.Launchpad.Initialize();
        return true;
      } catch (ex) {
        return new Error(ex);
      }
    })  
 
    ipcMain.on(ipc.onSetColor, async (event, spec: BaseColorSpec | BaseColorSpec[]) => {
      if (!this.Launchpad || !!this.Launchpad && !this.Launchpad.GetStatic().IsConnected()) return;
      if (Array.isArray(spec)) {
        this.Launchpad.send('sysex', [...SYSEX_COLOR, ...lodash.flatten(spec.map(s => (new Colorspec(s)).toArray())) ])
      } else {
        this.Launchpad.send('sysex', [...SYSEX_COLOR, ...(new Colorspec(spec)).toArray() ])
      }

    })

    this.registerLaunchpad();
  }

  static registerLaunchpad() {
    this.Launchpad = new LaunchpadX();
    
    const pressedButtons: Set<number> = new Set<number>();
    let counter = 0;
    this.Launchpad.on('pressed', btn => {
      pressedButtons.add(btn);
      //lodash.range(11, 98).map(i => ([2, i, i, i, i]))
      //this.Launchpad.send('sysex', [ 0, 32, 41, 2, 12, 3, 3, btn, 0, 0, counter ])
      //const rest = lodash.flatten(lodash.range(11, 11+89).map(i => ([3, i, 20, 20, 20])))
      //this.Launchpad.send('sysex', [  0, 32, 41, 2, 12, 3, ...rest ])
      App.mainWindow.webContents.send(ipc.onButtonStateUpdate, [...pressedButtons])
       
      /* const xy = LaunchpadX.ButtonToXY(btn)
      console.log(LaunchpadX.XYToButton(xy.x, xy.y)); */
    })
    this.Launchpad.on('released', btn => {
      //this.Launchpad.send('sysex', [ 0, 32, 41, 2, 12, 3, 3, btn, 0, 0, 0 ])
      pressedButtons.delete(btn);
      
      App.mainWindow.webContents.send(ipc.onButtonStateUpdate, [...pressedButtons])
    })
    this.Launchpad.Initialize();
  }
}