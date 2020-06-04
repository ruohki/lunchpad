import { EventEmitter } from 'events'
import { v4 as uuid } from 'uuid';
import { Action, ActionType, PlaySound, Delay, SwitchPage, StopAllMacros, TextToSpeech, LaunchApp, Hotkey } from '@lunchpad/types'

import { MacroAction } from '../actions';
import { SoundAction } from '../actions/sound';
import { DelayAction } from '../actions/delay';
import { SwitchPageAction } from '../actions/page';
import { StopAllMacrosAction } from '../actions/stopallmacros';
import { TextToSpeechAction } from '../actions/tts';
import { LaunchAppAction } from '../actions/launchapp';
import { HotkeyAction } from '../actions/hotkey';

export declare interface MacroRunner {
  on(event: 'onStart', listener: (id: string) => void): this;
  on(event: 'onFinished', listener: (id: string) => void): this;
  on(event: 'onStopAll', listener: () => void): this;
}

export class MacroRunner extends EventEmitter {
  private actions: MacroAction[] = []
  public id: string = uuid();

  private currentAction: MacroAction;
  private cancel: boolean = false;

  constructor(actions: Action[] = []) {
    super();
    
    for(const raw of actions) {
      if (raw.type === ActionType.Delay) this.actions.push(new DelayAction(raw as Delay));
      else if (raw.type === ActionType.PlaySound) this.actions.push(new SoundAction(raw as PlaySound));
      else if (raw.type === ActionType.SwitchPage) this.actions.push(new SwitchPageAction(raw as SwitchPage));
      else if (raw.type === ActionType.StopAllMacros) this.actions.push(new StopAllMacrosAction(raw as StopAllMacros));
      else if (raw.type === ActionType.TextToSpeech) this.actions.push(new TextToSpeechAction(raw as TextToSpeech));
      else if (raw.type === ActionType.LaunchApplication) this.actions.push(new LaunchAppAction(raw as LaunchApp));
      else if (raw.type === ActionType.PressAHotkey) this.actions.push(new HotkeyAction(raw as Hotkey));
    }
  }

  public async Run() {
    console.log("Running Macro:", this.id)
    this.emit('onStart', this.id);
    console.log("Queueing", this.actions.length, "actions")
    for(const action of this.actions) {
      if (!this.cancel) {
        this.currentAction = action;
        console.log("Running Action:", action.id, action.constructor['name'])
        if (action.constructor['name'] === StopAllMacrosAction.name) this.emit('onStopAll');
        // if the action should be awaited or just go next
        action.wait ? await action.Run() : action.Run();
        console.log("Finished Action:", action.id, action.constructor['name'])
      };
    }
    console.log("Finished Macro:", this.id)
    this.emit('onFinished', this.id);
  }

  public Stop() {
    this.cancel = true;
    this.currentAction.Stop();
  }
}