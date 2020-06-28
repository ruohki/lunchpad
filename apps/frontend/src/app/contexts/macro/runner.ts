import { EventEmitter } from 'events'
import { v4 as uuid } from 'uuid';

import { ILayoutContext } from '../layout';
import { LaunchpadButton } from '../layout/classes';
import { IOBSStudioContext } from '../obs-studio';
import { Action, ActionType } from '../../actions';
import { PushToTalkStart, PushToTalkEnd } from '../../actions/pushtotalk';
import { OBSSwitchScene } from '../../actions/obs-studio';
import { SetColor } from '../../actions/setcolor';
import { FlipFlopStart, FlipFlopMiddle, FlipFlopEnd } from '../../actions/flipflop';
import { settingsLabels } from '@lunchpad/types';
import { PlaySound } from '../../actions/playsound';
import { IAudioContext } from '@lunchpad/contexts';

export interface IMacroRunnerContexts {
  layout: Partial<ILayoutContext>
  obsStudio: Partial<IOBSStudioContext>
  audio: Partial<IAudioContext>
}

export declare interface MacroRunner {
  on(event: 'onStart', listener: (id: string) => void): this;
  on(event: 'onFinished', listener: (id: string) => void): this;
  on(event: 'onStopAll', listener: () => void): this;
  on(event: 'onStopButton', listener: (x: number, y: number) => void): this;
  on(event: 'onRestartButton', listener: (id: string, x: number, y: number) => void): this;
  
  on(event: 'onPushToTalkStart', listener: () => void): this;
  on(event: 'onPushToTalkEnd', listener: () => void): this;
}

function Clone<T>(instance: T): T {
  const copy = new (instance.constructor as { new (): T })();
  Object.assign(copy, instance);
  return copy;
}

export class MacroRunner extends EventEmitter {
  private button: LaunchpadButton;
  private contexts: IMacroRunnerContexts
  private down: boolean;

  private actions: Action[] = []
  public id: string = uuid();
  
  public x: number;
  public y: number;

  private startedActions: Array<Action> = [];

  private cancel: boolean = false;
  
  constructor(button: LaunchpadButton, contexts: IMacroRunnerContexts, x: number, y: number, down: boolean = true) {
    super();
    this.button = button;
    this.contexts = contexts
    this.down = down;
    this.x = x;
    this.y = y;
    
    for(const raw of down ? button.down : button.up) {
      switch (raw.type) {
        case ActionType.Delay:
        
        case ActionType.PushToTalkStart:
        case ActionType.SwitchPage:
        case ActionType.StopAllMacros:
        case ActionType.StopThisMacro:
        case ActionType.RestartThisMacro:
        case ActionType.TextToSpeech:
        case ActionType.LaunchApplication:
        case ActionType.PressAHotkey:
        case ActionType.FlipFlopStart:
        case ActionType.FlipFlopMiddle:
        case ActionType.FlipFlopEnd:
          this.actions.push(raw)
          break;
        case ActionType.PlaySound:
          (raw as PlaySound).setAudioContext(contexts.audio.audio);
          this.actions.push(raw)
          break;
        case ActionType.SetColor:
          (raw as SetColor).setColorFunction((color) => {
            console.log(button)
            button.color = color;
            contexts.layout.setButton(button, this.x, this.y, this.contexts.layout.activePage.id);
          });
          console.log(raw)
          this.actions.push(raw)
          break;
        case ActionType.OBSSwitchScene:
        case ActionType.OBSToggleSource:
        case ActionType.OBSToggleFilter:
        case ActionType.OBSStartStopStream:
        case ActionType.OBSSaveReplayBuffer:
        case ActionType.OBSToggleMixer:
          (raw as OBSSwitchScene).setOBSContext(contexts.obsStudio);
          this.actions.push(raw)
          break;
        default:
      }
    }
  }

  private removeRunningAction(action: Action) {
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
            if (action instanceof FlipFlopStart) {
              flipFlopA = (action as FlipFlopStart).isA;
              flipFlopActive = flipFlopA;
            } else if (action instanceof FlipFlopMiddle) {
              if (flipFlopA) {
                flipFlopActive = false;
              } else {
                flipFlopActive = true;
              }
              flipFlopA != flipFlopA
            } else if (action instanceof FlipFlopEnd) {
              flipFlopActive = true;

              const idx = (this.down ? this.button.down : this.button.up).findIndex(a => a.type === ActionType.FlipFlopStart);
              ((this.down ? this.button.down : this.button.up)[idx] as FlipFlopStart).isA = !flipFlopA;
              this.contexts.layout.setButton(this.button,this.x , this.y, this.contexts.layout.activePage.id);
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
  
            if (action.type === ActionType.StopAllMacros) this.emit('onStopAll');
            if (action.type === ActionType.StopThisMacro) this.emit('onStopButton', this.x, this.y)
            if (action.type === ActionType.RestartThisMacro) this.emit('onRestartButton', this.id, this.x, this.y)
            
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