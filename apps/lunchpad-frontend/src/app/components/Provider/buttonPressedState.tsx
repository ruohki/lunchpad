// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../../../../../types/window.require.d.ts" />

import React, { useState, useEffect } from 'react';
import { ipcChannels as ipc } from '@lunchpad/types';

const { ipcRenderer } = window.require('electron');

const initialState: Set<number> = new Set<number>([])
export const store = React.createContext(initialState);

const { Provider } = store;

const ButtonStateProvider = ({ children }) => {
  const [ pressed, setPressed ] = useState(initialState);
  
  useEffect(() => {
    const updateButtonState = (event, buttonState) => setPressed(new Set<number>(buttonState));
    ipcRenderer.on(ipc.onButtonStateUpdate, updateButtonState)
    return () => {
      ipcRenderer.removeListener(ipc.onButtonStateUpdate, updateButtonState)
    }
  })

  return (
    <Provider value={pressed}>
      {children}
    </Provider>
  )
}
export default ButtonStateProvider;