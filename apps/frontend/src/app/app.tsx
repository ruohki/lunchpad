// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../../../types/window.require.d.ts" />

import 'typeface-exo-2';
import 'typeface-roboto';
import 'typeface-source-sans-pro';
import 'typeface-oswald';
import 'typeface-noto-serif';
import "@fortawesome/fontawesome-free/css/all.css";

import * as React from 'react';

import Backend from 'react-dnd-html5-backend';
import { DndProvider } from 'react-dnd';
import { useSettings } from '@lunchpad/hooks';

import { GlobalStyle, AppContainer, ScaleBox } from '@lunchpad/base';
import { AudioContext, MidiContext, ModalContext, LayoutContext, MenuContext, NotificationContext } from '@lunchpad/contexts';
import { useEssentialCSSVariable } from '@lunchpad/hooks';
import { settingsLabels as settings } from '@lunchpad/types';

import Controller from './components/Controller';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MacroContext } from './contexts/macroengine';
import { Helmet } from './helmet';

const ProviderGarden = ({ children }) => {
  const [ output ] = useSettings(settings.soundOutput, 'default');

  return (
    <NotificationContext.Provider>
      <ErrorBoundary>
        <AudioContext.Provider sinkId={output}>
          <LayoutContext.Provider>
            <MidiContext.Provider>
              <MenuContext.Provider>
                <ModalContext.Provider>
                  <DndProvider backend={Backend}>
                    <MacroContext.Provider>
                      {children}
                    </MacroContext.Provider>
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
        <Helmet />
        <ScaleBox>
          <Controller />
        </ScaleBox>
      </ProviderGarden>
    </AppContainer>
  );
};

export default App;
