import * as React from 'react';
import lodash from 'lodash';

import { LaunchpadButton as Button } from '@lunchpad/base'

import { PadContainer, ButtonLook } from '../components';
import { XYToButton, ButtonToXY } from './helper'
import { IPadProps } from '..';
import { LaunchpadButton, ControllerType } from '@lunchpad/types';
import { MakeButtonColor } from '../helper';
const Component: React.SFC<IPadProps> = ({ onDragStart, onDragEnd, onDrop, onButtonPressed, onButtonReleased, onContextMenu, onSettingsButtonClick, activePage }) => {
  
  return (
    <PadContainer width={6} height={6}>
      {lodash.reverse(lodash.range(0, 6)).map((y) => lodash.range(0,6).map((x) => {
        const isButton = lodash.get(activePage, `buttons.${x}.${y}`, false);
        const button: LaunchpadButton  = lodash.get(activePage, `buttons.${x}.${y}`, new LaunchpadButton()) // as Button;
        const color = MakeButtonColor(button.color)
        
        return XYToButton(x,y) !== 35 ? (
          <Button
            x={x}
            y={y}
            color={color}
            keyId={XYToButton(x,y)}
            onDrop={onDrop}
            key={`${x}${y}`}
            onContextMenu={onContextMenu}
            onMouseDown={(e) => onButtonPressed(e, x, y, XYToButton(x,y), false)}
            onMouseUp={(e) => onButtonReleased(e, x, y, XYToButton(x,y), false)}
            canDrag={isButton}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          >
            <ButtonLook look={button.look} />
          </Button>
        ) : (
          <Button
            x={8}
            y={8}
            key="settings"
            keyId={42}
            color={"#6a45ff"}
            round
            onContextMenu={() => true}
            onClick={onSettingsButtonClick}
            onDrop={() => {}}
            canDrag={false}
          >
            SET
          </Button>
        )
      }
      ))}
    </PadContainer>
  )
}

export const Software6x6 = {
  name: "Small 6x6",
  type: ControllerType.Software,
  XYToButton,
  ButtonToXY,
  Component,
  initialize: lodash.noop,
  unload: lodash.noop,
  limitedColor: false
}