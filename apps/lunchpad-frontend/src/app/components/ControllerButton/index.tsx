import React, { SFC, useContext } from 'react';

import { useDrag, useDrop  } from 'react-dnd'
import { NativeTypes } from 'react-dnd-html5-backend'

import styled from 'styled-components';

import { useNotification } from '../Message';

import buttonMask from '../../../assets/buttonmask.png';
import { Severity } from '../Message/components';
import { store as controllerConfigurationContext } from '../Provider/controllerConfigurationStore';
import { LightingType, Colorspec } from '@lunchpad/types';

import { ipcChannels as ipc } from '@lunchpad/types';

const { ipcRenderer } = window.require('electron');

interface StyledButtonProps {
  round?: boolean
}

const StyledButtonContainer = styled.div<StyledButtonProps>`
  background-color: ${(props) => props.color};
  border-radius: ${({ round }) => round ? "999" : "8"}px;
  padding: 2px;
  margin: 4px;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  background-size: cover;
  background-image: url(${buttonMask});
  border: 0.3rem solid rgba(0,0,0,.4);
  border-bottom: .8rem solid rgba(0,0,0,0.4);

  &:hover {
    border: 0.3rem solid rgba(0,0,0,.30);
    border-bottom: .8rem solid rgba(0,0,0,.30);
  }

  &:active{
    padding-top: 0.2rem;
    border-bottom: 0.3rem solid rgba(0,0,0,.30);
  }
`
const StyledControllerButton = styled.button<StyledButtonProps>`
  flex-grow: 1;
  align-self: stretch;
  
  color: #d0d0d0;
  text-shadow: 2px 2px 1px #000;
  border: none;
  outline: none;
  background: none;

  text-overflow: ellipsis;
  font-weight: 600;
`;

const ClipContainer = styled.div`
  /* background-color: rgba(0,0,0, 0.8); */
  height: 100%;
  width: 100%;
  display: flex;
  align-content: center;

  & > *:first-child {
    background-size: cover;
    background-image: url(${buttonMask});
    color: white;
    background: rgba(0,0,0, 0.90);
    mix-blend-mode: multiply;

    svg {
      font-size: 3.5rem;
    }
  }

  & > * {
    text-shadow: none;
  }
`

interface ButtonProps {
  round?: boolean
  clip?: boolean
  color?: string
  keyId: string | number,
  onContextMenu: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>, id: number) => void
}

const ControllerButton: SFC<ButtonProps> = ({ children, onContextMenu, keyId, clip = false, color = "#b1b1b1", ...rest }) => {
  const [ show, remove ] = useNotification();
  const [ showWithDelay ] = useNotification();
  
  const [, drag] = useDrag({
    item: { id: keyId, type: "BUTTON"},
    end: (result) => {
      remove();
    },
  })

  const [, drop] = useDrop({
    accept: [ NativeTypes.FILE ,"BUTTON"],
    canDrop: (item, monitor) => {
      if ('files' in item) return true;
      if (item.id !== keyId) return true;
      
      return false;
    },
    collect: (monitor) => {
      if (!monitor.isOver()) {
        remove();
      } else if (monitor.isOver() && !monitor.canDrop()) {
        if (monitor.getItem().id === keyId) {
          show(`Cannot swap the button with itself. Please try to drop onto another button.`, 0, Severity.error);
        }
      }
    },
    hover: (item) => {
      //console.log(item)
    },
    drop: (item) => {
      if ('files' in item) {
        if (item.files.length > 1) {
          return showWithDelay(`Too many files, please just drop one audiofile on a button.`, 25000, Severity.error);
        } else if (!item.items[0].type.match("audio")) {
          return showWithDelay(`Only audio files are curently allowed to drag and drop onto buttons.`, 2500, Severity.error);
        }
      }

      showWithDelay(`Switched buttons`, 1000)
    }

  })
  
  const Button = (
    <StyledControllerButton
      ref={drag}
      onContextMenu={(e) => {
        onContextMenu(e, parseInt(keyId.toString()))
      }}
    >
      {children}
    </StyledControllerButton>
  )
  return (
    <StyledButtonContainer color={color} ref={drop} {...rest}>
      {clip ? <ClipContainer>{Button}</ClipContainer> : Button}
    </StyledButtonContainer>
  )
}

export default ControllerButton;