import { invoke } from '@tauri-apps/api/tauri';
import * as React from 'react';
import { GlobalStyle } from './components/globalStyle';
import { AppContainer } from './components/layout/container/app';
import { ScaleBox } from './components/layout/scalebox';
import { useEssentialCSSVariable } from './hooks/useCSSVariable';

import { listen } from '@tauri-apps/api/event'

enum LaunchpadType {
  Unknown,
  Legacy,
  S,
  MarkTwo,
  ProMarkTwo,
  MiniMarkThree ,
  X,
  ProMarkThree,
}

const LaunchpadNames = {
  [LaunchpadType.MiniMarkThree]: "Novation Launchpad Mini MK3"
}

type LaunchpadTypeString = keyof typeof LaunchpadType
export const App = () => {
  const ref = useEssentialCSSVariable();
  const [ is_connected, set_is_connected ] = React.useState<string>("");
  React.useEffect(async () => {
    const unlisten = await listen<{ message: string }>('device_disconnected', ({ payload }) => {
      console.log(payload.message)
      set_is_connected("");
    })

    return () => unlisten();
  })
  

  return (
    <AppContainer ref={ref}>
      <GlobalStyle />
      <ScaleBox>
        <pre>
          Device Connected: {is_connected !== "" ? is_connected : "No"}
        </pre>
        <button onClick={() => invoke("connect", { inputIdx: 2, outputIdx: 2 }).then((result: string) => {
          set_is_connected(LaunchpadNames[LaunchpadType[result as LaunchpadTypeString]]);
          if (LaunchpadType[result as LaunchpadTypeString] == LaunchpadType.MarkTwo) {
            console.log("Yay mark3");
          }
        }).catch(console.log)}>Connect</button>
        <button onClick={() => invoke("list_devices").then(console.log).catch(console.log)}>List</button>
        <button onClick={() => invoke("test_fn").then(console.log)}>Connect</button>
      </ScaleBox>
    </AppContainer>
  );
}