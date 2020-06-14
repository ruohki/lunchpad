// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../../../types/window.require.d.ts" />

import 'typeface-exo-2';

import * as React from 'react';

import Backend from 'react-dnd-html5-backend';
import { DndProvider } from 'react-dnd';
import { useLocalStorage  } from '@rehooks/local-storage';

import { GlobalStyle, AppContainer, ScaleBox } from '@lunchpad/base';
import { AudioContext, MidiContext, ModalContext, LayoutContext, MenuContext, NotificationContext } from '@lunchpad/contexts';
import { useEssentialCSSVariable } from '@lunchpad/hooks';
import { settingsLabels as settings } from '@lunchpad/types';

import Controller from './components/Controller';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MacroEngine } from './macro/index';

const ProviderGarden = ({ children }) => {
  const [ output ] = useLocalStorage(settings.soundOutput, 'default');

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
