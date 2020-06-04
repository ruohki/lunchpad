// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../../../types/window.require.d.ts" />

import 'typeface-exo-2';

import * as React from 'react';
import { v4 as uuid } from 'uuid';

import Backend from 'react-dnd-html5-backend';
import { DndProvider } from 'react-dnd';

import { GlobalStyle, AppContainer, ScaleBox } from '@lunchpad/base';
import { AudioContext, MidiContext, ModalContext, LayoutContext, MenuContext, NotificationContext } from '@lunchpad/contexts';
import { useSettings, useEssentialCSSVariable } from '@lunchpad/hooks';
import { settingsLabels as settings, PlaySound } from '@lunchpad/types';

import Controller from './components/Controller';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MacroEngine } from './macro/index';

/* const audio = new AudioManager();
console.log(audio)
audio.playSound('file:///Users/ruohki/Downloads/Bells.mp3', "default", .25, 0.5, 1); */
import LogRocket from 'logrocket';

const ProviderGarden = ({ children }) => {
  const [ output ] = useSettings(settings.soundOutput, 'default');
  const [ useLogRocket ] = useSettings(settings.debug.lockRocket, false);
  const [ userId ] = useSettings(settings.debug.userId, uuid());

  React.useEffect(() => {
    if (useLogRocket) {
      LogRocket.init('lunchpad/lunchpad');
      LogRocket.identify(userId);
    } else {
      LogRocket.init('lunchpad/lunchpad', {
        shouldSendData: () => false
      });
    }
  }, [useLogRocket] )
  return (
    <NotificationContext.Provider>
      <ErrorBoundary>
        <AudioContext.Provider sinkId={output}>
          <LayoutContext.Provider>
            <MidiContext.Provider>
              <MenuContext.Provider>
                <ModalContext.Provider>
                  <DndProvider backend={Backend}>
                    <MacroEngine />
                    {children}
                  </DndProvider>
                </ModalContext.Provider>
              </MenuContext.Provider>
            </MidiContext.Provider>
          </LayoutContext.Provider>
        </AudioContext.Provider>
      </ErrorBoundary>
    </NotificationContext.Provider>
  );
};

export const App = () => {
  const ref = useEssentialCSSVariable();
  const [ state, setState ] = React.useState<boolean>(true);

  return (
    <AppContainer ref={ref}>
      <GlobalStyle />
      <ProviderGarden>
        <ScaleBox>
          <Controller />
        </ScaleBox>
      </ProviderGarden>
    </AppContainer>
  );
};

export default App;
