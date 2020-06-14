import { settingsLabels } from '@lunchpad/types';

const robotjs = window.require('robotjs');

function tryParse(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export class PushToTalk {
  private isPushed: boolean = false
  
  private keyPressed: string;
  private modifiers: string[];
  
  public Push() {
    if (!this.isPushed) {
      const key = localStorage.getItem(settingsLabels.ptt.key);
      const modifier: string[] = tryParse(localStorage.getItem(settingsLabels.ptt.modifier)) ?? [];
      this.isPushed = true;
      this.keyPressed = key;
      this.modifiers = modifier;

      robotjs.keyToggle(key, "down", modifier);
      
      console.log("Pressed PTT")
    }
  }

  public Release() {
    if (this.isPushed) {
      this.isPushed = false;
      robotjs.keyToggle(this.keyPressed, "up", this.modifiers);
      console.log("Released PTT")
    }
  }
}