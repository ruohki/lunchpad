import { v4 as uuid } from 'uuid';
export type Color = {
  r: number,
  g: number,
  b: number
}

export enum ActionType {
  DoNothing = "DO_NOTHING",
  PlaySound = "PLAY_SOUND",
  StopAllSounds = "STOP_ALL_SOUND",
  LaunchApplication = "LAUNCH_SHELL",
  PerformWebrequest = "WEBREQUEST",
  PressAHotkey = "HOTKEY"
}

export class Action {
  public type: ActionType
  public id: string

  constructor(type: ActionType) {
    this.type = type;
    this.id = uuid();
  }
}

export class DoNothing extends Action {}

export class PlaySound extends Action {
  public soundfile: string
  public volume: number
  public start: number
  public end: number
  public duration: number

  public outputDevice?: string

  constructor(soundfile: string, volume = 1, start = 0, end = 0) {
    super(ActionType.PlaySound);
    const audio = new AudioContext();

    this.soundfile = soundfile;
    this.volume = volume;
    this.start = start;
    this.end = end;

    fetch(soundfile)
      .then(response => response.arrayBuffer())
      .then(arrayBuffer => audio.decodeAudioData(arrayBuffer))
      .then(buffer => this.duration = buffer.duration);

    this.outputDevice = "default"; //outputDevice;
  }

  public static From(action: PlaySound) {
    const act = new PlaySound(action.soundfile, action.volume, action.start, action.end);
    act.id = action.id;
    return act;
  }
}
export class StopAllSounds extends Action {
  constructor() {
    super(ActionType.StopAllSounds);
  }
}

export class LaunchApplication extends Action {
  public executable: string
  public arguments: string

  constructor(executable: string, args: string) {
    super(ActionType.LaunchApplication);

    this.executable = executable;
    this.arguments = args;
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

export class PressAHotkey extends Action {
  public buttons: number[]

  constructor(buttons: number[]) {
    super(ActionType.PressAHotkey);
    this.buttons = buttons;
  }
}

export class Button {
  public title: string
  public x: number
  public y: number

  public color: Color
  public pressed: Action[] = []

  constructor(title: string, x: number, y: number, color = {r:0, g: 0, b: 0}) {
    this.title = title;
    this.x = x;
    this.y = y;
    this.color = color;
    this.pressed = []
  }
}