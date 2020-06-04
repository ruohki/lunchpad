// augmentations.d.ts or whatever you want to call it.
import electron from 'electron';

import * as robotjs from 'robotjs';


declare global {
  interface Window {
    require(moduleSpecifier: 'electron'): typeof electron;
    require(moduleSpecifier: 'robotjs'): typeof robotjs;
  }

  interface HTMLAudioElement {
    context: any;
    setSinkId(id: string): Promise<void>;
  }
}