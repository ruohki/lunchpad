import React from 'react';
import styled from 'styled-components';
import { transparentize } from 'polished';

import { motion } from 'framer-motion'
import { COLOR_BLACK, COLOR_MENU, COLOR_ALMOSTBLACK } from '../gobalStyle';

export const Backdrop = styled(({ children, ...rest}) => (
  <motion.div {...rest}>{children}</motion.div>
))`
  z-index: 910;
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
  
  width: 600px;
  height: 600px;

  box-shadow: 0 0 25px #000;

  display: flex;
  flex-direction: column;
 
  
  & > div {
    padding: 1rem;
  }

  & > div:nth-child(odd) {
    background-color ${COLOR_BLACK};
  }

  & > div:nth-child(even) {
    
    flex-grow: 1;

    div {
      margin-bottom: .5rem;
      display: flex;
      flex-direction;
      align-items: center;

      div:nth-child(1) {
        flex-basis: 25%;
        padding-right: 1rem;
        display: flex;
        justify-content: flex-end;
      }

      &:nth-child(2) {
        flex-grow: 1;
      }
    }

  }
`

export const Divider = styled.hr`
  margin: .5rem .5rem 1rem .5rem;
  border: 1px solid ${COLOR_ALMOSTBLACK};
`