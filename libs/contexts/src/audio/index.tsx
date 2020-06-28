import * as React from 'react';
import useMediaDevices from './useMediaDevices';
import { IMediaDevice } from '@lunchpad/types';

export interface IAudioContext {
  audio: AudioContext,
  outputDevices: IMediaDevice[]
}

const audioContext = React.createContext<Partial<IAudioContext>>({})
const { Provider } = audioContext;

const AudioProvider = ({ children, sinkId = "default" }) => {
  const audio = React.useRef(new AudioContext());
  const outputDevices  = (useMediaDevices("audiooutput") as IMediaDevice[]) ?? []
  
  const value = React.useMemo(() => ({
    outputDevices,
    audio: audio.current
  }), [ audio, outputDevices ])

  return (
    <Provider value={value}>
      {children}
    </Provider>
  )
}

const ctx = {
  Provider: AudioProvider,
  Context: audioContext
}

export {
  ctx as AudioContext
}