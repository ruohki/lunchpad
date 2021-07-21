import * as React from 'react';
import styled from 'styled-components';

// Container to have 1:1 content box when scaling the app

export const AppContainer = styled.div`
  position: absolute;
  transform: translateZ(0);

  width: 100vw;
  height: 100vh;
  
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
`