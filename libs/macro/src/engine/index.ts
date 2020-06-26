import { EventEmitter } from 'events'
import { v4 as uuid } from 'uuid';
import { Action, ActionType, PlaySound, Delay, SwitchPage, StopAllMacros, TextToSpeech, LaunchApp, Hotkey, StopThisMacro, RestartThisMacro, PushToTalkStart, PushToTalkEnd, settingsLabels, LaunchpadButton, SetColor, FlipFlopMiddle, FlipFlopStart, FlipFlopEnd } from '@lunchpad/types'

import { MacroAction } from '../actions';
import { SoundAction } from '../actions/sound';
import { DelayAction } from '../actions/delay';
import { SwitchPageAction } from '../actions/page';
import { StopAllMacrosAction } from '../actions/stopallmacros';
import { TextToSpeechAction } from '../actions/tts';
import { LaunchAppAction } from '../actions/launchapp';
import { HotkeyAction } from '../actions/hotkey';
import { StopThisMacroAction } from '../actions/stopthis';
import { RestartThisMacroAction } from '../actions/restartmacro';
import { PushToTalkStartAction, PushToTalkEndAction } from '../actions/pushtotalk';
import { SetColorAction } from '../actions/setcolor';
import { FlipFlopStartAction, FlipFlopMiddleAction, FlipFlopEndAction } from '../actions/flipflop';

export declare interface MacroRunner {
  on(event: 'onStart', listener: (id: string) => void): this;
  on(event: 'onFinished', listener: (id: string) => void): this;
  on(event: 'onStopAll', listener: () => void): this;
  on(event: 'onStopButton', listener: (x: number, y: number) => void): this;
  on(event: 'onRestartButton', listener: (id: string, x: number, y: number) => void): this;
  
  on(event: 'onPushToTalkStart', listener: () => void): this;
  on(event: 'onPushToTalkEnd', listener: () => void): this;
}

export class MacroRunner extends EventEmitter {
  private button: LaunchpadButton;
  private setButton: (button: LaunchpadButton) => void
  private down: boolean;

  private actions: MacroAction[] = []
  public id: string = uuid();
  
  public x: number;
  public y: number;

  private startedActions: Array<MacroAction> = [];

  private cancel: boolean = false;
  
  constructor(button: LaunchpadButton, setButton: (button: LaunchpadButton) => void, x: number, y: number, down: boolean = true) {
    super();
    this.button = button;
    this.setButton = setButton
    this.down = down;
    this.x = x;
    this.y = y;
    
    for(const raw of down ? button.down : button.up) {
      if (raw.type === ActionType.Delay) this.actions.push(new DelayAction(raw as Delay));
      else if (raw.type === ActionType.PlaySound) this.actions.push(new SoundAction(raw as PlaySound));
      else if (raw.type === ActionType.PushToTalkStart) this.actions.push(new PushToTalkStartAction(raw as PushToTalkStart));
      else if (raw.type === ActionType.PushToTalkEnd) this.actions.push(new PushToTalkEndAction(raw as PushToTalkEnd));
      else if (raw.type === ActionType.SwitchPage) this.actions.push(new SwitchPageAction(raw as SwitchPage));
      else if (raw.type === ActionType.StopAllMacros) this.actions.push(new StopAllMacrosAction(raw as StopAllMacros));
      else if (raw.type === ActionType.StopThisMacro) this.actions.push(new StopThisMacroAction(raw as StopThisMacro));
      else if (raw.type === ActionType.RestartThisMacro) this.actions.push(new RestartThisMacroAction(raw as RestartThisMacro));
      else if (raw.type === ActionType.TextToSpeech) this.actions.push(new TextToSpeechAction(raw as TextToSpeech));
      else if (raw.type === ActionType.LaunchApplication) this.actions.push(new LaunchAppAction(raw as LaunchApp));
      else if (raw.type === ActionType.PressAHotkey) this.actions.push(new HotkeyAction(raw as Hotkey));
      else if (raw.type === ActionType.FlipFlopStart) this.actions.push(new FlipFlopStartAction(raw as FlipFlopStart));
      else if (raw.type === ActionType.FlipFlopMiddle) this.actions.push(new FlipFlopMiddleAction(raw as FlipFlopMiddle));
      else if (raw.type === ActionType.FlipFlopEnd) this.actions.push(new FlipFlopEndAction(raw as FlipFlopEnd));
      else if (raw.type === ActionType.SetColor) this.actions.push(new SetColorAction(raw as SetColor, (color) => {
        button.color = color;
        setButton(button);
      }));
    }
  }

  private removeRunningAction(action: MacroAction) {
    const index = this.startedActions.findIndex(a => a.id === action.id);
    this.startedActions.splice(index, 1);
  }

  public async Run() {
    let actionPromises: Array<Promise<unknown>> = []
    
    console.log("Running Macro:", this.id)
    this.emit('onStart', this.id);
    console.log("Queueing", this.actions.length, "actions")

    let containsFlipFlop = (this.down ? this.button.down : this.button.up).findIndex(a => a.type === ActionType.FlipFlopStart) !== -1;
    let flipFlopActive = false;
    let flipFlopA = true;

    return new Promise(async (resolve, reject) => {
      do {
        actionPromises = new Array<Promise<unknown>>();
        
        for(const action of this.actions) {
          if (containsFlipFlop) {
            if (action instanceof FlipFlopStartAction) {
              flipFlopA = (action as FlipFlopStartAction).action.isA;
              flipFlopActive = flipFlopA;
            } else if (action instanceof FlipFlopMiddleAction) {
              if (flipFlopA) {
                flipFlopActive = false;
              } else {
                flipFlopActive = true;
              }
              flipFlopA != flipFlopA
            } else if (action instanceof FlipFlopEndAction) {
              flipFlopActive = true;

              const idx = (this.down ? this.button.down : this.button.up).findIndex(a => a.type === ActionType.FlipFlopStart);
              ((this.down ? this.button.down : this.button.up)[idx] as FlipFlopStart).isA = !flipFlopA;
              this.setButton(this.button);
            }

            if (!flipFlopActive) continue;
          }

          //if (containsFlipFlop && !flipFlopActive) continue;
          // dont execute push to talk stuff when its turned off
          if (action.constructor['name'] === PushToTalkStart.name || action.constructor['name'] === PushToTalkEnd.name) {
            if (!localStorage.hasItem(settingsLabels.ptt.enabled) || (localStorage.getItem(settingsLabels.ptt.enabled) !== "true")) {
              continue;
            }
          }
  
          if (!this.cancel) {
            this.startedActions.push(action);
            console.log("Running Action:", action.id, action.constructor['name'])
  
            if (action.constructor['name'] === StopAllMacrosAction.name) this.emit('onStopAll');
            if (action.constructor['name'] === StopThisMacroAction.name) this.emit('onStopButton', this.x, this.y)
            if (action.constructor['name'] === RestartThisMacroAction.name) this.emit('onRestartButton', this.id, this.x, this.y)
            
            // if the action should be awaited or just go next
            const promise = action.Run(this);
            actionPromises.push(promise);
  
            promise.then(() => this.removeRunningAction(action));
  
            if (action.wait) {
              await promise;
            }
  
            console.log("Finished Action:", action.id, action.constructor['name'])
            
          };
        }
        
        await Promise.all([...actionPromises]);
      } while(this.button.loop && !this.cancel)
      
      if (this.cancel) reject();
      else resolve();
      


      this.emit('onFinished', this.id);
    });
  }

  public Stop() {
    this.cancel = true;

    for(const action of this.startedActions) {
      action.Stop();
    }
  }
}