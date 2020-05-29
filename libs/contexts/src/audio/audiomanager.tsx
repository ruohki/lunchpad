import { v4 as uuid } from 'uuid';
import { EventEmitter } from 'events';
import isEqual from 'lodash/isEqual';

declare interface AudioManager {
  on(event: 'onStartedPlayback', listener: Function): this;
  on(event: 'onEndedPlayback', listener: Function): this;
  on(event: 'onFinished', listener: (id: string) => void): this;
}

class AudioManager extends EventEmitter {
  private defaultOutput = "default";
  private Sounds = new Map<string, HTMLAudioElement>();

  constructor() {
    super();
    this.removeAllListeners();
    this.on('onFinished', () => {
      if (this.Sounds.size <= 0) {
        this.emit('onEndedPlayback');
      }
    })

  }

  loadFile(fileName: string, loop = false, context = false): Promise<string> {
    const id = uuid();
    const audio = new Audio(fileName);
    
    audio.loop = loop;
    audio.context = context

    return new Promise((resolve) => {
      audio.setSinkId(this.defaultOutput).then(() => {
        audio.onerror = (err) => this.emit('onError', err, id);
        audio.onended = () => {
          this.Sounds.delete(id);
          this.emit('onFinished', id)
        }
        this.Sounds.set(id, audio)
        resolve(id);
      });
    })
  }

  setSinkId(sinkId: string): void {
    this.defaultOutput = sinkId;
  }

  findSinkId(name: string): Promise<string> {
    return new Promise((res, rej) => {
      navigator.getUserMedia({ audio: true }, () => {
        navigator.mediaDevices.enumerateDevices().then((devices) => {
          devices.forEach(d => {
            if ((d.kind === "audiooutput") && (d.label === name)) {
              return res(d.deviceId)
            }
          })
          rej(null);
        });
      },
      (err) => rej(err)
    )});
  }

  async playAudio(id: string, volume = 1): Promise<boolean> {
    if (this.Sounds.size === 1) {
      this.emit('onStartedPlayback');
    }
    if (this.Sounds.has(id)) {
      const audio = this.Sounds.get(id);
      audio.volume = volume;
      await audio.play();
      return true;
    }

    return false;
  }
  
  stopAudio(id: string): boolean {
    if (this.Sounds.has(id)) {
      const audio = this.Sounds.get(id);
      audio.pause();
      return this.Sounds.delete(id)
    }
    return false;
  }

  stopAllAudio() {
    this.Sounds.forEach((audio) => {
      audio.pause();
    });
    this.Sounds.clear();
    this.emit('onEndedPlayback');
  }

  findByContext(context: any) {
    return new Promise(res => {
      this.Sounds.forEach((audio, id) => {
        if (isEqual(audio.context, context)) {
          res(id);
        }
      });
      res(undefined)
    })
  }
}

export default AudioManager;