import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion'
import { COLOR_MENU } from '@lunchpad/base';

export const Backdrop = styled.div`
  z-index: 900;
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  left: 0;
`

export const ContextMenuContainer = styled(({ children, ...rest}) => (
  <motion.div {...rest}>{children}</motion.div>
))`
  position: absolute;
  background-color: ${COLOR_MENU};
  
  border-radius: 5px;

  max-width: 600px;
  min-width: 250px;
  box-shadow: 0 0 10px 1px #000;
`
