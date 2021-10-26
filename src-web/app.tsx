import { invoke } from '@tauri-apps/api/tauri';
import * as React from 'react';
import { GlobalStyle } from './components/globalStyle';
import { AppContainer } from './components/layout/container/app';
import { ScaleBox } from './components/layout/scalebox';
import { useEssentialCSSVariable } from './hooks/useCSSVariable';

import { listen } from '@tauri-apps/api/event'
import { useModal } from './components/layout/components/modal';
import Settings from './components/settings';

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
  const [ showModal, closeModal ] = useModal()
  
  const ref = useEssentialCSSVariable();
  const [ is_connected, set_is_connected ] = React.useState<string>("");
  
  //@ts-expect-error :/
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

        <button onClick={() => showModal(<Settings onClose={() => closeModal()} />)}>Show</button>
      </ScaleBox>
    </AppContainer>
  );
}