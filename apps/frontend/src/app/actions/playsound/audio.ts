import { EventEmitter } from "events";
import { settingsLabels } from '@lunchpad/types';

export class Sound extends EventEmitter {
  public audioContext: AudioContext;
  private audioElement: HTMLAudioElement = new Audio();
  private audioBuffer: AudioBuffer;
  private bufferSource: AudioBufferSourceNode;
  private destination: MediaStreamAudioDestinationNode;

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
    
    this.destination = this.audioContext.createMediaStreamDestination();
    this.bufferSource.connect(this.destination)
    try {
      this.audioElement.srcObject = this.destination.stream;
    } catch {}

  }
  
  public async Play(): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const begin = this.audioBuffer.duration * this.start
      const duration = this.audioBuffer.duration * this.end - begin
      this.audioElement.volume = this.volume;
      //const int = setTimeout(() => this.audioContext.close(), this.audioBuffer.duration * 1000);
      this.bufferSource.addEventListener('ended', async () => {
        //clearTimeout(int);
        this.emit('onFinished');
        this.bufferSource.stop();
        this.audioElement.srcObject = null;
        this.audioBuffer = null;
        //this.audioContext.close();
        return resolve();
      });
      this.audioElement.play();
      this.bufferSource.start(0, begin, duration);
      //@ts-ignore //IT DOES EXIST
      console.log(this.sinkId);
      if (this.sinkId === "inherit") {
        this.audioElement.setSinkId(localStorage.getItem(settingsLabels.soundOutput) || "default")
      } else this.audioElement.setSinkId(this.sinkId);
    })
  }

  public Stop() {
    try {
      // crucial or else sound will stop after 48 playbacks
      this.audioElement.srcObject = null;
      this.bufferSource.stop();
      this.audioBuffer = null;
    } catch (ex) {}
  }
}