import * as React from 'react';
import AudioManager from './audiomanager';
import useMediaDevices from './useMediaDevices';
import { IMediaDevice } from '@lunchpad/types';


export interface IAudioContext {
  loadFile(filename: string, loop: boolean, context: boolean): Promise<string>
  playAudio(id: string, volume: number): Promise<boolean>
  stopAudio(id: string): boolean
  stopAllAudio(): void
  outputDevices: IMediaDevice[]
}

const AM = new AudioManager();
const loadFile = (filename: string, loop: boolean, context: boolean): Promise<string> => AM.loadFile(filename, loop, context);
const playAudio = (id: string, volume: number): Promise<boolean> => AM.playAudio(id, 1);
const stopAudio = (id: string): boolean => AM.stopAudio(id);
const stopAllAudio = (): void => AM.stopAllAudio();

const audioContext = React.createContext<Partial<IAudioContext>>({})
const { Provider } = audioContext;

const AudioProvider = ({ children, sinkId = "default" }) => {
  const outputDevices  = (useMediaDevices("audiooutput") as IMediaDevice[]) ?? []
  AM.setSinkId(sinkId);
  return (
    <Provider value={{
      outputDevices,
      loadFile,
      playAudio,
      stopAudio,
      stopAllAudio
    }}>
      {children}
    </Provider>
  )
}

export const AudioContext = {
  Provider: AudioProvider,
  Context: audioContext
}