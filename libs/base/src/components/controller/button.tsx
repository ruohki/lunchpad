import * as React from 'react';
import styled from 'styled-components';
import lodash from 'lodash';

import { useDrag, useDrop  } from 'react-dnd'
import { NativeTypes } from 'react-dnd-html5-backend'

import buttonMask from '../../../assets/buttonMask';
import useKeyboardJs from 'libs/hooks/src/useKeyboard';
import { useMouse, useMouseHovered } from 'react-use';

interface StyledButtonProps {
  round?: boolean
}

const StyledButtonContainer = styled.div<StyledButtonProps>`
  background-color: ${(props) => props.color};
  border-radius: ${({ round }) => round ? "999" : "8"}px;
  margin: 3px;
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
  note: { note: number, cc?: boolean },
  disabled?: boolean,
  x: number,
  y: number,
  onMouseDown?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>, x: number, y: number, note: number, cc: boolean) => void,
  onMouseUp?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>, x: number, y: number, note: number, cc: boolean) => void,

  onClick?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>, x: number, y: number, note: number) => void,
  onContextMenu?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>, x: number, y: number, note: number) => void,
  onDragStart?: (x: number, y: number, modifier: string) => void
  onDragEnd?: (x: number, y: number, modifier: string) => void
  onDrop?: ( target: any, payload: any, modifier: string) => void;
  canDrag: boolean
  
  // TODO: Remove alter
  onDraggedWithoutModifier?: () => void
}

interface IDragPayload {
  id?: string,
  type?: string,
  files?: File[]
}

export const LaunchpadButton: React.SFC<ButtonProps> = (props) => {
  const [ willMove ] = useKeyboardJs("ctrl")
  const [ willCopy ] = useKeyboardJs("alt")

  const [ disabled, setDisabled ] = React.useState(false);
  
  const modifier = willMove ? "ctrl" : willCopy ? "alt" : ""
  const canMove = willMove || willCopy;
  
  const [, drag] = useDrag({
    item: { id: props.note.note, type: "BUTTON", x: props.x, y: props.y},
    begin: () => {
      setDisabled(true)
      //@ts-ignore
      props.onMouseUp({ button: 0 });
      props.onDragStart(props.x, props.y, modifier );
    },
    end: (result) => {
      setDisabled(false)
      props.onDragEnd(props.x, props.y, modifier);
    },
    canDrag: () => canMove && props.canDrag
  })

  const [, drop] = useDrop({
    accept: [ NativeTypes.FILE ,"BUTTON"],
    canDrop: (item) => {
      const data = item as IDragPayload
      if ('files' in data) return true;
      if (parseInt(data.id) !== props.note.note) return true;
      
      return false;
    },
    collect: (monitor) => {
      if (!monitor.isOver()) {
        //remove();
      } else if (monitor.isOver() && !monitor.canDrop()) {
        if (monitor.getItem().id === props.note.note) {
          //show(`Cannot swap the button with itself. Please try to drop onto another button.`, 0, Severity.error);
        }
      }
    },
    drop: (item) => props.onDrop({ x: props.x, y: props.y }, item, modifier)
  })

  const Button = (
    <StyledControllerButton
      disabled={disabled}
      ref={drag}
      onContextMenu={(e) => props.onContextMenu(e, props.x, props.y, props.note.note)}
      onMouseDown={(e) => !canMove ? props.onMouseDown(e, props.x, props.y, props.note.note, props.note.cc) : lodash.noop()}
      onMouseUp={(e) => !canMove ? props.onMouseUp(e, props.x, props.y, props.note.note, props.note.cc) : lodash.noop()}
      onMouseLeave={(e) => {
        if (!canMove && e.buttons === 1 && props.canDrag) {
          props.onMouseUp(e, props.x, props.y, props.note.note, props.note.cc) 
          props.onDragEnd(props.x, props.y, modifier);
        } else {
          lodash.noop()}
        }
      }
      onClick={(e) => props.onClick(e, props.x, props.y, props.note.note)}
    >
      {props.children}
    </StyledControllerButton>
  )
  return (
    <StyledButtonContainer color={props.color} ref={drop}>
      {props.clip ? <ClipContainer round={props.round}>{Button}</ClipContainer> : Button}
    </StyledButtonContainer>
  )
}

LaunchpadButton.defaultProps = {
  clip: false,
  color: "#b1b1b1",
  round: false,
  disabled: false,
  onDrop: lodash.noop,
  onClick: lodash.noop,
  onContextMenu: lodash.noop,
  onDragStart: lodash.noop,
  onDragEnd: lodash.noop,
  onDraggedWithoutModifier: lodash.noop
}