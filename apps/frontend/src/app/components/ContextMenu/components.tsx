
import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';

import { COLOR_BLURPLE, COLOR_ALMOSTBLACK, COLOR_BLACK, COLOR_WHITE } from '@lunchpad/base'

export const MenuParent = styled(({ children, onClick, ...rest }) => {
  
  return (
    <div {...rest}>{React.Children.map(children, (child, index) => (
      React.cloneElement(child, {
        onClick: (e) => onClick(e, child.props.id || index)
      })
    ))}
    </div>
  )
})`
  display: flex;
  flex-direction: column;
  padding: 0;
  margin-bottom: 2px;
  padding: 1rem 0;
`


export const MenuItem = styled(({ children, ...rest}) => (
  <motion.div {...rest}>{children}</motion.div>
))`
  padding: 1rem 2.5rem;
  white-space: nowrap;
  transition: background-color 0.1s ease;

  &:hover {
    background-color: ${COLOR_BLURPLE};
  }

  svg {
    max-width: 20px;
    margin-right: 2rem;
  }
`

export const MenuDivider = styled.hr`
  margin: .5rem .5rem .5rem .5rem;
  border: 1px solid ${COLOR_ALMOSTBLACK};
`

export const VolumeParent = styled.div`
  display: flex;
  align-items: center;
  padding: 1rem 2.5rem;
  
  svg {
    max-width: 20px;
    margin-right: 2rem;
  }
`
  
export const VolumeBackground = styled.div`
  display: flex;
  height: .5rem;
  width: 100%;
  background-color: ${COLOR_BLACK};
  cursor: pointer;
`

export const VolumeFiller = styled.div`
  height: 100%;
  width: 45%;
  background-color: ${COLOR_BLURPLE};
`

export const VolumeKnob = styled.div`
  left: 20px;
  border-radius: 3px;
  width: 1rem;
  height: 1.5rem;
  background-color: ${COLOR_WHITE};
  transform: translate(-25%, -33.5%);
`
