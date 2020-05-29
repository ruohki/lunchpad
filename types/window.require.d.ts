// augmentations.d.ts or whatever you want to call it.

import electron from 'electron';
import naudio from 'naudiodon';
import settings from 'electron-settings';

import * as robotjs from 'robotjs';

module easymidi {

}

declare global {
  interface Window {
    require(moduleSpecifier: 'electron'): typeof electron;
    require(moduleSpecifier: 'easymidi'): typeof easymidi;
    require(moduleSpecifier: 'naudiodon'): typeof naudio;
    require(moduleSpecifier: 'electron-settings'): typeof settings;
    require(moduleSpecifier: 'robotjs'): typeof robotjs;
  }

  interface HTMLAudioElement {
    context: any;
    setSinkId(id: string): Promise<void>;
    
  }
}