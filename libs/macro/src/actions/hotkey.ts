import { Hotkey, HotkeyKeystrokeType, HotkeyKeystrokeDelay, HotkeyKeystrokeSimple, HotkeyKeystrokeString, HotkeyKeystrokeEvent } from '@lunchpad/types';
import { MacroAction } from './index';

//import * as robot from 'robotjs';
import * as lodash from 'lodash';

const robot = window.require('robotjs');

const delay = (time: number): Promise<unknown> => {
  return new Promise(resolve => setTimeout(resolve, time));
}

type keydown = {
  k: string,
  m: string[]
}
export class HotkeyAction extends MacroAction {
  private action: Hotkey;
  private cancel: boolean = false;
  
  private downedKeys: keydown[] = [];
  
  constructor(action: Hotkey) {
    super()
    this.action = action;
    this.id = action.id;
    this.wait = action.wait;
  }

  public async Run(): Promise<unknown> {
    return new Promise(async resolve => {
      if (this.cancel) return resolve();

      for(const part of this.action.keystrokes) {
        if (part.type === HotkeyKeystrokeType.Delay) {
          const keystroke = part as HotkeyKeystrokeDelay;
          console.log("Hotkey: Delay", keystroke.delay)
          await delay(lodash.clamp(keystroke.delay, 0, 5000));
        } else if (part.type === HotkeyKeystrokeType.String) {
          const keystroke = part as HotkeyKeystrokeString;
          robot.setKeyboardDelay(keystroke.delay);
          console.log("Hotkey: String", keystroke.text)
          if (keystroke.delay > 0) {
            //robot.typeStringDelayed(keystroke.text, 60000 / keystroke.delay);
            for(const key of keystroke.text.split("")) {
              robot.typeString(key);
              await delay(keystroke.delay);
              if (this.cancel) return resolve();
            }
          } else {
            robot.typeString(keystroke.text);
          }
        } else if (part.type === HotkeyKeystrokeType.SimpleDown) {
          const keystroke = part as HotkeyKeystrokeSimple;
          const mod = keystroke.modifier;
          console.log("Hotkey: KeyDown", keystroke.key, "mod", mod)
          robot.keyToggle(keystroke.key, "down", mod)
          if (this.action.restoreAllAtEnd) {
            this.downedKeys.push({ k: keystroke.key, m: mod });
          }
        } else if (part.type === HotkeyKeystrokeType.SimpleUp) {
          const keystroke = part as HotkeyKeystrokeSimple;
          const mod = keystroke.modifier;
          console.log("Hotkey: KeyUp", keystroke.key, "mod", mod)
          robot.keyToggle(keystroke.key, "up", mod)
          if (this.action.restoreAllAtEnd) {
            this.downedKeys.splice(this.downedKeys.findIndex(p => lodash.isEqual(p, {k: keystroke.key, m: keystroke.modifier})), 1)
          }
        } else if (part.type === HotkeyKeystrokeType.SimpleDownUp) {
          const keystroke = part as HotkeyKeystrokeSimple;
          const mod = keystroke.modifier;
          console.log("Hotkey: Keypress", keystroke.key, "mod", mod)
          robot.keyTap(keystroke.key, mod);
        }
      }

      if (this.action.restoreAllAtEnd && this.downedKeys.length > 0) {
        this.downedKeys.forEach(k => robot.keyToggle(k.k, "up", k.m));
      }

      return resolve();
    })
  }

  public Stop() {
    this.cancel = true;
  }
}