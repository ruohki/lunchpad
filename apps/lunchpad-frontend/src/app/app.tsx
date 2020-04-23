
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../../../types/window.require.d.ts" />

import 'typeface-exo-2';

import React from 'react';
import Backend from 'react-dnd-html5-backend'

import { DndProvider } from 'react-dnd'

import ControllerConfigurationProvider from './components/Provider/controllerConfigurationStore';

import Global from './components/gobalStyle';
import Controller from './components/Controller';

import Settings from './components/settings'

import { Container, ScaleBox } from './components/Layout';
import { NotificationProvider } from './components/Message';
import { ContextMenuProvider } from './components/ContextMenu';

import useEssentialCSSVariables from './hooks/useEssentialCSSVariables';



const ProviderGarden = ({ children }) => (
  <NotificationProvider>
    <ContextMenuProvider>
      <DndProvider backend={Backend}>
        <ControllerConfigurationProvider>
          <Settings visible={false} />
          {children}
        </ControllerConfigurationProvider>
      </DndProvider>
    </ContextMenuProvider>
  </NotificationProvider>
)

export const App = () => {
  const ref = useEssentialCSSVariables()
  
  return (
    <Container ref={ref}>
      <Global />
      <ProviderGarden>
        <ScaleBox>
          <Controller />
        </ScaleBox>
      </ProviderGarden>
    </Container>
  );
};

export default App;
