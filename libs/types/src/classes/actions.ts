import * as lodash from 'lodash';
import { v4 as uuid } from 'uuid';

export enum ButtonMode {
  Normal = "NORMAL",
  Toggle = "TOGGLE",
  Hold = "HOLD",
  Random = "RANDOM"
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
  
  PushToTalkStart = "START_PTT",
  PushToTalkEnd = "END_PTT",

  VoiceMeeter = "VOICE_MEETER",
}

export class Action {
  public type: ActionType
  public id: string
  public wait: boolean
  
  constructor(type: ActionType, id: string = uuid()) {
    this.type = type;
    this.id = id;
    this.wait = true;
  }
}

export class PairedAction extends Action {
  public startId?: string;
  public endId?: string;

  public isOther(action: Action): boolean {
    return action.id === this.endId || action.id === this.startId;
  }
}

export class PushToTalkStart extends PairedAction {
  public endId: string;

  constructor(id: string = uuid()) {
    super(ActionType.PushToTalkStart, id);
  }
}

export class PushToTalkEnd extends PairedAction {
  public startId: string;

  constructor(startId: string, id: string = uuid()) {
    super(ActionType.PushToTalkEnd, id);
    this.startId = startId;
  }
}


export class SwitchPage extends Action {
  public pageId: string;

  constructor(pageId: string, id: string = uuid()) {
    super(ActionType.SwitchPage, id);
    this.pageId = pageId;
  }
}

export class VoiceMeeter extends Action {
  constructor(id: string = uuid()) {
    super(ActionType.SwitchPage, id);
  }
}

export class DoNothing extends Action {}

export class Delay extends Action {
  public delay: number;

  constructor(delay: number, id: string = uuid()) {
    super(ActionType.Delay, id);
    this.delay = delay;
  }
}

export class PlaySound extends Action {
  public soundfile: string
  public volume: number
  public start: number
  public end: number
  public duration: number

  public outputDevice?: string

  constructor(soundfile: string, outputDevice = "default", id: string = uuid()) {
    super(ActionType.PlaySound, id);
    const audio = new AudioContext();

    this.soundfile = soundfile;
    this.volume = 1;
    this.start = 0;
    this.end = 1;

    fetch(soundfile)
      .then(response => response.arrayBuffer())
      .then(arrayBuffer => audio.decodeAudioData(arrayBuffer))
      .then(buffer => this.duration = buffer.duration);

    this.outputDevice = outputDevice;
  }
}

export class StopAllMacros extends Action {
  constructor(id: string = uuid()) {
    super(ActionType.StopAllMacros);
    this.id = id;
  }
}

export class StopThisMacro extends Action {
  constructor(id: string = uuid()) {
    super(ActionType.StopThisMacro);
    this.id = id;
  }
}

export class RestartThisMacro extends Action {
  constructor(id: string = uuid()) {
    super(ActionType.RestartThisMacro);
    this.id = id;
  }
}

export class TextToSpeech extends Action {
  public text: string;
  public voice: string;
  public volume: number;

  constructor(text: string, volume = 1, id: string = uuid()) {
    super(ActionType.TextToSpeech);
    this.id = id;
    this.text = text;
    this.volume = volume;

    const voices = speechSynthesis.getVoices();
    const voice = lodash.find(voices, v => v.default)
    this.voice = voice.voiceURI;
  }
}

export class LaunchApp extends Action {
  public executable: string
  public arguments: string
  public hidden: boolean
  public killOnStop: boolean

  constructor(executable = "", args = "", hidden = false, kill = true, id: string = uuid()) {
    super(ActionType.LaunchApplication);

    this.id = id;
    this.executable = executable;
    this.arguments = args;
    this.hidden = hidden
    this.killOnStop = kill;
  }
}

type Method = 'POST' | 'GET' | 'PUT' | 'DELETE' | 'PATCH';
export class PerformWebrequest extends Action {
  public url: string
  public method: Method
  public headers: string
  public body: string

  constructor(url: string, method: Method, headers: string, body: string ) {
    super(ActionType.PerformWebrequest);

    this.url = url;
    this.method = method;
    this.headers = headers;
    this.body = body;
  }
}

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

export class HotkeyKeystroke {
  public id: string
  public type: HotkeyKeystrokeType
  constructor(type: HotkeyKeystrokeType, id = uuid()) {
    this.id = id;
    this.type = type;
  }
}

export class HotkeyKeystrokeSimple extends HotkeyKeystroke {
  public event: HotkeyKeystrokeEvent
  public key: string
  public modifier: string[]

  constructor(key: string, modifier = new Array<string>(), event: HotkeyKeystrokeEvent, id = uuid()) {
    if (event === HotkeyKeystrokeEvent.KeyDown) super(HotkeyKeystrokeType.SimpleDown);
    if (event === HotkeyKeystrokeEvent.KeyUp) super(HotkeyKeystrokeType.SimpleUp);
    if (event === HotkeyKeystrokeEvent.KeyDownUp) super(HotkeyKeystrokeType.SimpleDownUp);
    
    this.id = id;
    this.key = key;
    this.event = event;
    this.modifier = modifier;
  }
}

export class HotkeyKeystrokeDelay extends HotkeyKeystroke {
  public delay: number;
  constructor(delay: number, id = uuid()) {
    super(HotkeyKeystrokeType.Delay);
    this.id = id;
    this.delay = delay;
  }
}

export class HotkeyKeystrokeString extends HotkeyKeystroke {
  public text: string;
  public delay: number;
  constructor(text: string, delay = 0, id = uuid()) {
    super(HotkeyKeystrokeType.String);
    this.id = id;
    this.text = text;
    this.delay = delay;
  }
}

export class Hotkey extends Action {
  public keystrokes: HotkeyKeystroke[]
  public restoreAllAtEnd: boolean
  constructor(keystrokes: HotkeyKeystroke[] = [], restore = true, id = uuid()) {
    super(ActionType.PressAHotkey);
    this.id = id;
    this.keystrokes = keystrokes;
    this.restoreAllAtEnd = restore;
  }
}