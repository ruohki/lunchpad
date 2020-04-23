// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../../../../../types/window.require.d.ts" />

import React, { useEffect } from 'react';
import styled from 'styled-components';

const { remote } = window.require('electron');

export const Container = styled.div`
  position: absolute;
  transform: translateZ(0);

  width: 100vw;
  height: 100vh;
  
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
`

// CSS Vars here to stop SC emitting hundrets of classes
export const ScaleBox = styled.div`
  width: var(--width);
  height: var(--height);

  transition: width 0.1s ease, height 0.1s ease;
`