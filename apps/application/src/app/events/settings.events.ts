import { ipcMain } from 'electron';
import * as settings from 'electron-settings';

import { ipcChannels } from '@lunchpad/types';
import { stringify } from 'querystring';
export default class SettingsEvents { 

  static boostrapSettingsEvents() {

    ipcMain.handle(ipcChannels.onSettingsGet, async (event, name: string, defaultValue: any) => { 
      return settings.get(name, defaultValue);
    })

    ipcMain.handle(ipcChannels.onSettingsSet, async (event, name: string, value: any) => {
      settings.set(name, value);
    })
  }
}