import { invoke } from '@tauri-apps/api/tauri';
import * as React from 'react';
import { GlobalStyle } from './components/globalStyle';
import { AppContainer } from './components/layout/container/app';
import { ScaleBox } from './components/layout/scalebox';
import { useEssentialCSSVariable } from './hooks/useCSSVariable';

export const App = () => {
  const ref = useEssentialCSSVariable();

  return (
    <AppContainer ref={ref}>
      <GlobalStyle />
      <ScaleBox>
        <button onClick={() => invoke("connect", { inputIdx: 0, outputIdx: 1 }).then(console.log).catch(console.log)}>Connect</button>
        <button onClick={() => invoke("list_devices").then(console.log).catch(console.log)}>List</button>
        {/* <button onClick={() => invoke("test").then(console.log)}>Connect</button> */}
      </ScaleBox>
    </AppContainer>
  );
}