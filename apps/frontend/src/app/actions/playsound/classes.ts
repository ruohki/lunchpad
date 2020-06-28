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

  constructor(soundfile: string = "", outputDevice = "default", id: string = uuid()) {
    super(ActionType.PlaySound, id);

    this.soundfile = soundfile;
    this.volume = 1;
    this.start = 0;
    this.end = 1;
    this.outputDevice = outputDevice;
  }

  public setAudioContext = (audio: AudioContext) => this.audioContext = audio;
  public async Run(): Promise<unknown> {
    console.log("Running")
    const response = await fetch(this.soundfile);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = await this.audioContext.decodeAudioData(arrayBuffer);
    this.duration = buffer.duration
    this.sound = new Sound(
      this.soundfile,
      this.outputDevice,
      this.volume,
      this.start,
      this.end
    )
    this.sound.audioContext = this.audioContext;
    await this.sound.Init()
    if (this.sound) {
      return this.sound.Play();
    } else return false;
  }

  public Stop() {
    this.sound.Stop();
  }
}