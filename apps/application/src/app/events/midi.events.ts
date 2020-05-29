import * as easymidi from 'easymidi';
import * as lodash from 'lodash';

import * as settings from 'electron-settings';

import App from '../app';

import { ipcMain  } from 'electron';

import { ipcChannels as ipc, RGBColor, settingsLabels } from '@lunchpad/types'

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
  private static Launchpad: LaunchpadBase;
  
  static boostrapMidiEvents() {
    /* MidiEvents.output = new Midi.output();
    MidiEvents.input = new Midi.input(); */
    console.log("inputs", easymidi.getInputs());
    console.log("outputs", easymidi.getOutputs());

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
 
    ipcMain.on(ipc.onSetColor, async (event, button: number, color: RGBColor) => {
      if (!this.Launchpad || !!this.Launchpad && !this.Launchpad.GetStatic().IsConnected()) return;
      this.Launchpad.setColor(button, color);
    })

    ipcMain.on(ipc.onSetManyColors, async (event, args: Array<[number, RGBColor]>) => {
      console.log(args)
      if (!this.Launchpad || !!this.Launchpad && !this.Launchpad.GetStatic().IsConnected()) return;
      this.Launchpad.setManyColors(args, true);
    })

    settings.watch('settings.device', (n,o) => {
      console.log('received', n, o)
      if (n !== o) {
        if (this.Launchpad) this.Launchpad.Destroy();
        this.registerLaunchpad(n);
      }
    });

    const settingsDevice = settings.get('settings.device', null)
    if (settingsDevice) {
      if (settingsDevice === LaunchpadMK2.GetName()) this.registerLaunchpad(new LaunchpadMK2());
      if (settingsDevice === LaunchpadX.GetName()) this.registerLaunchpad(new LaunchpadX());
    }

    setInterval(() => {
      if (this.Launchpad) {
        if (!this.Launchpad.GetStatic().IsConnected()) {
          this.Launchpad.Destroy();
          this.Launchpad = null;
          console.log("Launchpad disconnected")
        }
      } else {
        const controller = settings.get(settingsLabels.controller, null);
        if (controller) {
          if (controller === LaunchpadMK2.GetName()) this.registerLaunchpad(new LaunchpadMK2());
           if (controller === LaunchpadX.GetName()) this.registerLaunchpad(new LaunchpadX());
        } else {
          console.log(LaunchpadMK2.IsConnected(), LaunchpadX.IsConnected())
          if (LaunchpadMK2.IsConnected()) this.registerLaunchpad(new LaunchpadMK2());
          if (LaunchpadX.IsConnected()) this.registerLaunchpad(new LaunchpadX());
        }
      }
    }, 500)
  }

  static registerLaunchpad(device: LaunchpadBase) {
    console.log(device)
    if (!device || (device && !device.GetStatic().IsConnected())) return;
    
    this.Launchpad = device;
    console.log("Connecting to", device.GetStatic().GetName())
    
    const pressedButtons: Set<number> = new Set<number>();
    
    this.Launchpad.on('pressed', btn => {
      pressedButtons.add(btn);
      console.log(btn)
      this.Launchpad.send('sysex', [  0, 32, 41, 2, 24, 11, btn, 0, 0, 63 ])

      App.mainWindow.webContents.send(ipc.onButtonStateUpdate, [...pressedButtons])
    })
    this.Launchpad.on('released', btn => {
      pressedButtons.delete(btn);
      
      App.mainWindow.webContents.send(ipc.onButtonStateUpdate, [...pressedButtons])
    })
    this.Launchpad.Initialize();
  }
}