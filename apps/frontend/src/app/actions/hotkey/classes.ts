import { v4 as uuid } from 'uuid';
import lodash from 'lodash';
import { JsonProperty, Serializable } from 'typescript-json-serializer';

import { ActionType, Action } from '..';
const robot = window.require('robotjs');

export enum HotkeyKeystrokeType {
  SimpleDown = "SIMPLE_DOWN",
  SimpleUp = "SIMPLE_UP",
  SimpleDownUp = "SIMPLE_DOWN_UP",
  Delay = "DELAY",
  String = "STRING"
}

export enum HotkeyKeystrokeEvent {
  KeyDown = "KEY_DOWN",
  KeyUp = "KEY_UP",
  KeyDownUp = "KEY_DOWN_UP"
}

type keydown = {
  k: string,
  m: string[]
}

const delay = (time: number): Promise<unknown> => {
  return new Promise(resolve => setTimeout(resolve, time));
}

@Serializable()
export class HotkeyKeystroke {
  @JsonProperty()
  public id: string
  
  @JsonProperty()
  public type: HotkeyKeystrokeType
  
  constructor(type: HotkeyKeystrokeType, id = uuid()) {
    this.id = id;
    this.type = type;
  }
}

@Serializable()
export class HotkeyKeystrokeSimple extends HotkeyKeystroke {
  @JsonProperty()
  public event: HotkeyKeystrokeEvent
  
  @JsonProperty()
  public key: string
  
  @JsonProperty({type: String})
  public modifier: string[]

  constructor(key: string, modifier = new Array<string>(), event: HotkeyKeystrokeEvent, id = uuid()) {
    if (event === HotkeyKeystrokeEvent.KeyDown) super(HotkeyKeystrokeType.SimpleDown, id);
    if (event === HotkeyKeystrokeEvent.KeyUp) super(HotkeyKeystrokeType.SimpleUp, id);
    if (event === HotkeyKeystrokeEvent.KeyDownUp) super(HotkeyKeystrokeType.SimpleDownUp, id);
    
    this.key = key;
    this.event = event;
    this.modifier = modifier;
  }
}

@Serializable()
export class HotkeyKeystrokeDelay extends HotkeyKeystroke {
  @JsonProperty()
  public delay: number;

  constructor(delay: number, id = uuid()) {
    super(HotkeyKeystrokeType.Delay, id);
    this.delay = delay;
  }
}

@Serializable()
export class HotkeyKeystrokeString extends HotkeyKeystroke {
  @JsonProperty()
  public text: string;
  
  @JsonProperty()
  public delay: number;
  
  constructor(text: string, delay = 0, id = uuid()) {
    super(HotkeyKeystrokeType.String, id);
    this.text = text;
    this.delay = delay;
  }
}

@Serializable()
export class Hotkey extends Action {
  @JsonProperty()
  public keystrokes: HotkeyKeystroke[]
  
  @JsonProperty()
  public restoreAllAtEnd: boolean
  
  private cancel: boolean = false;
  private downedKeys: keydown[] = [];

  constructor(keystrokes: HotkeyKeystroke[] = [], restore = true, id = uuid()) {
    super(ActionType.PressAHotkey, id);
    this.keystrokes = keystrokes;
    this.restoreAllAtEnd = restore;
  }

  public async Run(): Promise<unknown> {
    return new Promise(async resolve => {
      if (this.cancel) return resolve();

      for(const part of this.keystrokes) {
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
          if (this.restoreAllAtEnd) {
            this.downedKeys.push({ k: keystroke.key, m: mod });
          }
        } else if (part.type === HotkeyKeystrokeType.SimpleUp) {
          const keystroke = part as HotkeyKeystrokeSimple;
          const mod = keystroke.modifier;
          console.log("Hotkey: KeyUp", keystroke.key, "mod", mod)
          robot.keyToggle(keystroke.key, "up", mod)
          if (this.restoreAllAtEnd) {
            this.downedKeys.splice(this.downedKeys.findIndex(p => lodash.isEqual(p, {k: keystroke.key, m: keystroke.modifier})), 1)
          }
        } else if (part.type === HotkeyKeystrokeType.SimpleDownUp) {
          const keystroke = part as HotkeyKeystrokeSimple;
          const mod = keystroke.modifier;
          console.log("Hotkey: Keypress", keystroke.key, "mod", mod)
          robot.keyTap(keystroke.key, mod);
        }
      }

      if (this.restoreAllAtEnd && this.downedKeys.length > 0) {
        this.downedKeys.forEach(k => robot.keyToggle(k.k, "up", k.m));
      }

      return resolve();
    })
  }

  public Stop() {
    this.cancel = true;
  }
}