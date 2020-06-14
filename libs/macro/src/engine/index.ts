import { EventEmitter } from 'events'
import { v4 as uuid } from 'uuid';
import { Action, ActionType, PlaySound, Delay, SwitchPage, StopAllMacros, TextToSpeech, LaunchApp, Hotkey, StopThisMacro, RestartThisMacro, PushToTalkStart, PushToTalkEnd, settingsLabels } from '@lunchpad/types'

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
  private actions: MacroAction[] = []
  public id: string = uuid();
  
  public x: number;
  public y: number;

  private startedActions: Array<MacroAction> = [];
  private currentAction: MacroAction;
  private cancel: boolean = false;

  constructor(actions: Action[] = [], x: number, y: number) {
    super();
    
    this.x = x;
    this.y = y;

    for(const raw of actions) {
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
    }
  }

  private removeRunningAction(action: MacroAction) {
    const index = this.startedActions.findIndex(a => a.id === action.id);
    this.startedActions.splice(index, 1);
  }

  public async Run() {
    const actionPromises: Array<Promise<unknown>> = []
    

    console.log("Running Macro:", this.id)
    this.emit('onStart', this.id);
    console.log("Queueing", this.actions.length, "actions")

    return new Promise(async (resolve, reject) => {
      
      for(const action of this.actions) {
        // dont execute push to talk stuff when its turned off
        if (action.constructor['name'] === PushToTalkStart.name || action.constructor['name'] === PushToTalkEnd.name) {
          if (!localStorage.hasItem(settingsLabels.ptt.enabled) || (localStorage.getItem(settingsLabels.ptt.enabled) !== "true")) {
            continue;
          }
        }

        if (!this.cancel) {
          this.startedActions.push(action);
          this.currentAction = action;
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
  
      Promise.all(actionPromises).then(() => {
        console.log("Finished Macro:", this.id)
        this.emit('onFinished', this.id);
        
        if (this.cancel) reject();
        else resolve();
      })
    });
  }

  public Stop() {
    this.cancel = true;
    //this.currentAction.Stop();
    for(const action of this.startedActions) {
      action.Stop();
    }
  }
}