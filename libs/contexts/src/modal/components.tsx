import React from 'react';
import styled from 'styled-components';
import { transparentize } from 'polished';

import { motion } from 'framer-motion'
import { COLOR_BLACK, COLOR_MENU } from '@lunchpad/base';

export const Backdrop = styled(({ children, ...rest}) => (
  <motion.div {...rest}>{children}</motion.div>
))`
  z-index: 800;
  position: absolute;
  background-color: ${transparentize(0.2, COLOR_BLACK)};

  display: flex;
  justify-content: center;
  align-items: center;

  top: 0;
  bottom: 0;
  right: 0;
  left: 0;
`

export const Container = styled(({ children, ...rest}) => (
  <motion.div {...rest}>{children}</motion.div>
))`
  background-color: ${COLOR_MENU};
  border-radius: 5px;
  app-region: drag;
  width: 600px;
  height: 600px;

  box-shadow: 0 0 25px #000;
  overflow: hidden;
`
