import { v4 as uuid } from 'uuid';
import { MacroRunner } from '../contexts/macro/runner';

import { JsonProperty, Serializable, deserialize, serialize } from 'typescript-json-serializer';

@Serializable()
export class Action {
  @JsonProperty()
  public type: ActionType
  
  @JsonProperty()
  public id: string
  
  @JsonProperty()
  public wait: boolean
  
  constructor(type: ActionType, id: string = uuid()) {
    this.type = type;
    this.id = id;
    this.wait = true;
  }
  
  public async Run(runner: MacroRunner): Promise<unknown> {
    return;
  }

  public Stop(): void {}
}

@Serializable()
export class PairedAction extends Action {
  @JsonProperty()
  public startId?: string;

  @JsonProperty()
  public endId?: string;

  public isOther(action: Action): boolean {
    return action.id === this.endId || action.id === this.startId;
  }
}

@Serializable()
export class TripleAction extends PairedAction {
  @JsonProperty()
  public middleId?: string;
  public isOther(action: Action): boolean {
    return action.id === this.endId || action.id === this.startId || action.id === this.middleId;
  }
}


export enum ActionType {
  PlaySound = "PLAY_SOUND",            // done
  StopAllMacros = "STOP_ALL_MACROS",    // maybe stop all macros
  LaunchApplication = "LAUNCH_SHELL",  
  PerformWebrequest = "WEBREQUEST",
  PressAHotkey = "HOTKEY",
  TextToSpeech = "TEXT_TO_SPEECH",
  Delay = "DELAY",                     // done
  SwitchPage = "SWITCH_PAGE",          // done
  StopThisMacro = "STOP_THIS_MACRO",
  RestartThisMacro = "RESTART_THIS_MACRO",
  SetColor = "SET_COLOR",
  PushToTalkStart = "START_PTT",
  PushToTalkEnd = "END_PTT",

  FlipFlopStart = "FLIP_FLOP_START",
  FlipFlopMiddle = "FLIP_FLOP_MIDDLE",
  FlipFlopEnd = "FLIP_FLOP_END",

  OBSSwitchScene = "OBS_SCENE",
  OBSToggleSource = "OBS_TOGGLE_SOURCE",
  OBSToggleMixer = "OBS_TOGGLE_MIXER",
  OBSToggleFilter = "OBS_TOGGLE_FILTER",
  OBSStartStopStream = "OBS_TOGGLE_STREAM",
  OBSSaveReplayBuffer = "OBS_SAVE_REPLAY",

  VoiceMeeter = "VOICE_MEETER",
}