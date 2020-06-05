import React from 'react';

import range from 'lodash/range';
import reverse from 'lodash/reverse';
import get from 'lodash/get';

import { LaunchpadButton } from '@lunchpad/base'
import { ControllerType } from '@lunchpad/types'

import { PadContainer } from '../components';
import { XYToButton, ButtonToXY, MakeButtonColor } from './helper'
import { IPadProps } from '..';

const EmptyButton = (x, y) => ({
  title: "",
  x,
  y,
  color: {r: 0, g: 0, b: 0}
})

const Component: React.SFC<IPadProps> = ({ onDrop, onButtonPressed, onContextMenu, onSettingsButtonClick, activePage }) => {
  
  return (
    <PadContainer width={6} height={6}>
      {reverse(range(0, 6)).map((y) => range(0,6).map((x) => {
        const button  = get(activePage?.buttons ?? {}, `[${x}][${y}]`, EmptyButton(x,y)) // as Button;
        const color =  MakeButtonColor(button.color)
        
        return XYToButton(x,y) !== 35 ? (
          <LaunchpadButton
            x={x}
            y={y}
            color={color}
            keyId={XYToButton(x,y)}
            onDrop={onDrop}
            key={`${x}${y}`}
            onContextMenu={onContextMenu}
            onClick={(e) => {
              onButtonPressed(e, x, y, XYToButton(x,y), false);
            }}
          >
            {button.title}
          </LaunchpadButton>
        ) : (
          <LaunchpadButton
            x={8}
            y={8}
            key="settings"
            keyId={42}
            color={"#6a45ff"}
            round
            onContextMenu={() => true}
            onClick={onSettingsButtonClick}
            onDrop={() => {}}
          >
            SET
          </LaunchpadButton>
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
  limitedColor: false
}