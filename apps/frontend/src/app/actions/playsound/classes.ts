import { v4 as uuid } from 'uuid';
import { ActionType, Action } from '..';
import { Sound } from './audio';

import { JsonProperty, Serializable } from 'typescript-json-serializer';
import { IAudioContext } from '@lunchpad/contexts';

@Serializable()
export class PlaySound extends Action {
  private audioContext: AudioContext;

  private sound: Sound;

  @JsonProperty()
  public soundfile: string

  @JsonProperty()
  public volume: number

  @JsonProperty()
  public start: number

  @JsonProperty()
  public end: number

  @JsonProperty()
  public duration: number

  @JsonProperty()
  public outputDevice?: string

  constructor(soundfile: string = "", outputDevice = "default", duration: number, id: string = uuid()) {
    super(ActionType.PlaySound, id);

    this.soundfile = soundfile;
    this.volume = 1;
    this.start = 0;
    this.end = 1;
    this.duration = duration;
    this.outputDevice = outputDevice;
  }

  public setAudioContext = (audio: AudioContext) => this.audioContext = audio;
  public async Run(): Promise<unknown> {
    try {
      this.sound = new Sound(
        this.soundfile,
        this.outputDevice,
        this.volume,
        this.start,
        this.end
      )
      this.sound.audioContext = this.audioContext;

      if (await this.sound.Init()) {
        return this.sound.Play();
      } else return false;
    } catch (ex) {}
  }

  public Stop() {
    this.sound.Stop();
  }
}