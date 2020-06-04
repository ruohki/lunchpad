import { EventEmitter } from 'events';

import { PlaySound } from '@lunchpad/types';
import { MacroAction } from './index';

class Sound extends EventEmitter {
  private audioContext: AudioContext = new AudioContext();
  private audioElement: HTMLAudioElement = new Audio();
  private audioBuffer: AudioBuffer;
  private bufferSource: AudioBufferSourceNode;

  public readonly file: string;
  public duration = (): number => this.audioBuffer ? this.audioBuffer.duration : 0;

  public sinkId: string = "default";
  public volume: number = 1;
  
  public start: number = 0;
  public end: number = 1;
  
  constructor(file: string, sinkId = "default", volume = 1, start = 0, end = 1) {
    super();
    this.file = file;
    this.sinkId = sinkId;
    this.volume = volume;
    this.start = start;
    this.end = end;
  }

  public async Init(): Promise<void> {
    const response = await fetch(this.file);
    const arrayBuffer = await response.arrayBuffer()
    this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    
    this.bufferSource = this.audioContext.createBufferSource();
    this.bufferSource.buffer = this.audioBuffer;
    
    const destination = this.audioContext.createMediaStreamDestination();
    this.bufferSource.connect(destination)

    this.audioElement.srcObject = destination.stream;
  }
  
  public async Play(): Promise<unknown> {
    return new Promise((resolve, reject) => {
      
      const begin = this.audioBuffer.duration * this.start
      const duration = this.audioBuffer.duration * this.end - begin
      this.audioElement.volume = this.volume;
      this.bufferSource.addEventListener('ended', () => {
        this.emit('onFinished');
        return resolve();
      });
      this.bufferSource.start(0, begin, duration);
      this.audioElement.play();
      
      //@ts-ignore //IT DOES EXIST
      this.audioElement.setSinkId(this.sinkId);
    })
  }

  public Stop() {
    this.audioElement.pause();
    this.bufferSource.stop();
    this.bufferSource.disconnect();
  }
}

export class SoundAction extends MacroAction {
  private action: PlaySound;
  private sound: Sound;

  constructor(action: PlaySound) {
    super()
    this.action = action;
    this.id = action.id;
    this.wait = action.wait;

    this.sound = new Sound(
      action.soundfile,
      action.outputDevice,
      action.volume,
      action.start,
      action.end
    )
  }

  public async Run(): Promise<unknown> {
    await this.sound.Init()
    return this.sound.Play();
  }

  public Stop() {
    this.sound.Stop();
  }
}