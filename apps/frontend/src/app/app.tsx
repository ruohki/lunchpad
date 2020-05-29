// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../../../types/window.require.d.ts" />

import 'typeface-exo-2';

import React from 'react';

import Backend from 'react-dnd-html5-backend';
import { DndProvider } from 'react-dnd';

import { GlobalStyle, AppContainer, ScaleBox } from '@lunchpad/base';
import { AudioContext, MidiContext, ModalContext, LayoutContext, MenuContext, NotificationContext } from '@lunchpad/contexts';
import { useSettings, useEssentialCSSVariable } from '@lunchpad/hooks';
import { settingsLabels as settings } from '@lunchpad/types';

import Controller from './components/Controller';

const ProviderGarden = ({ children }) => {
  const [output] = useSettings(settings.soundOutput, 'default');

  return (
    <AudioContext.Provider sinkId={output}>
      <LayoutContext.Provider>
        <MidiContext.Provider>
          <NotificationContext.Provider>
              <MenuContext.Provider>
                <ModalContext.Provider>
                  <DndProvider backend={Backend}>{children}</DndProvider>
                </ModalContext.Provider>
              </MenuContext.Provider>
          </NotificationContext.Provider>
        </MidiContext.Provider>
      </LayoutContext.Provider>
    </AudioContext.Provider>
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
