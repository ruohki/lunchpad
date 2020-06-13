import * as React from 'react';
import styled from 'styled-components';

import { useDrag, useDrop  } from 'react-dnd'
import { NativeTypes } from 'react-dnd-html5-backend'

import buttonMask from '../../../assets/buttonMask';

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

  transition: border 0.15s ease;

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
  opacity: ${({ disabled }) => disabled ? "0.1" : "1"};
  color: #d0d0d0;
  text-shadow: 2px 2px 1px #000;
  border: none;
  outline: none;
  background: none;

  text-overflow: ellipsis;
  font-weight: 600;
`;

const ClipContainer = styled.div<StyledButtonProps>`
  /* background-color: rgba(0,0,0, 0.8); */
  height: 100%;
  width: 100%;
  display: flex;
  align-content: center;

  & > *:first-child {
    background-size: cover;
    background-image: url(${buttonMask});
    color: white;
    border-radius: ${({ round }) => round ? "999px" : 0};
    background: rgba(0,0,0, 0.90);
    mix-blend-mode: multiply;

    svg {
      font-size: 2rem;
      top: unset !important;
      position: unset !important;
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
  disabled?: boolean,
  x: number,
  y: number,
  onClick?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>, x: number, y: number, note: number) => void,
  onContextMenu?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>, x: number, y: number, note: number) => void,
  onDrop: ( target: any, payload: any) => void;
}

interface IDragPayload {
  id?: string,
  type?: string,
  files?: File[]
}

export const LaunchpadButton: React.SFC<ButtonProps> = ({ onDrop, children, onClick, onContextMenu, x, y, keyId, clip = false, color = "#b1b1b1", ...rest }) => {
  const [ disabled, setDisabled ] = React.useState(false);

  const [, drag] = useDrag({
    item: { id: keyId, type: "BUTTON", x, y},
    begin: () => setDisabled(true),
    end: (result) => {
      //remove();
      setDisabled(false)
    },
  })

  const [, drop] = useDrop({
    accept: [ NativeTypes.FILE ,"BUTTON"],
    canDrop: (item) => {
      const data = item as IDragPayload
      if ('files' in data) return true;
      if (data.id !== keyId) return true;
      
      return false;
    },
    collect: (monitor) => {
      if (!monitor.isOver()) {
        //remove();
      } else if (monitor.isOver() && !monitor.canDrop()) {
        if (monitor.getItem().id === keyId) {
          //show(`Cannot swap the button with itself. Please try to drop onto another button.`, 0, Severity.error);
        }
      }
    },
    hover: (item) => {
      //console.log(item)
    },
    drop: (item) => onDrop({ x, y }, item)
      /* const data = item as IDragPayload;
      if ('files' in data) {
        if (data.files.length > 1) {
          //return showWithDelay(`Too many files, please just drop one audiofile on a button.`, 25000, Severity.error);
        } else if (!data.files[0].type.match("audio")) {
          //return showWithDelay(`Only audio files are curently allowed to drag and drop onto buttons.`, 2500, Severity.error);
        }
      } else if ('id' in data) {
        //onSwitch(data.id, )
        //showWithDelay(`Switched buttons`, 1000)
      } */
    //}
  })
  
  const Button = (
    <StyledControllerButton
      disabled={disabled}
      ref={drag}
      onContextMenu={(e) => {
        onContextMenu(e, x, y, parseInt(keyId.toString()))
      }}
      onClick={(e) => onClick(e, x, y, parseInt(keyId.toString()))}
    >
      {children}
    </StyledControllerButton>
  )
  return (
    <StyledButtonContainer color={color} ref={drop} {...rest}>
      {clip ? <ClipContainer round={rest.round}>{Button}</ClipContainer> : Button}
    </StyledButtonContainer>
  )
}

LaunchpadButton.defaultProps = {
  clip: false,
  color: "#b1b1b1",
  onClick: () => true,
  onContextMenu: () => true,
  round: false,
  disabled: false
}