import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion'
import { COLOR_MENU, COLOR_BLACK, COLOR_ALMOSTBLACK, COLOR_BLURPLE, COLOR_NOTBLACK, COLOR_DARKER, COLOR_REDISH, COLOR_WHITE } from '../gobalStyle';



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

  max-width: 400px;
  min-width: 200px;
  box-shadow: 0 0 10px 1px #000;
`

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

export const Slider = styled.input.attrs({
  type: "range"
})`
  overflow: hidden;
  display: block;
  appearance: none;
  
  width: 100%;
  margin: 0;
  height: 1.5rem;
  cursor: pointer;

  background-color: transparent;

  &::-webkit-slider-runnable-track {
    width: 100%;
    height: 0.5rem;
    background: ${COLOR_BLACK};
  }

  &::-webkit-slider-thumb {
    position: relative;
    appearance: none;
    height: 1.5rem;
    width: 1rem;
    background: ${COLOR_WHITE};
    border-radius: 3px;
    border: 0;
    top: 50%;
    transform: translateY(-50%);
    transition: background-color 150ms;
  }

  &:hover,
  &:focus {
    outline: none;
    &::-webkit-slider-thumb {
      background-color: ${COLOR_BLURPLE};
    }
  }
`