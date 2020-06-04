import React from 'react';
import { Output } from 'webmidi'

import range from 'lodash/range';
import reverse from 'lodash/reverse';
import get from 'lodash/get';
import flatten from 'lodash/flattenDeep';

import { LaunchpadButton, Tooltip } from '@lunchpad/base'
import { IconCaretRight, IconCaretUpSolid, IconCaretDownSolid, IconCaretLeftSolid, IconCaretRightSolid } from '@lunchpad/icons';
import { LayoutContext, MidiContext } from '@lunchpad/contexts'
import { Page, ControllerType } from '@lunchpad/types'

import { Container } from './components';
import { XYToButton, MakeButtonColor } from './helper'
import { IPadProps } from '..';

const EmptyButton = (x, y) => ({
  title: "",
  x,
  y,
  color: {r: 0, g: 0, b: 0}
})

const Component: React.SFC<IPadProps> = ({ onButtonPressed, onContextMenu, onSettingsButtonClick, activePage }) => {
  
  return (
    <Container>
      {reverse(range(0, 6)).map((y) => range(0,6).map((x) => {
        const button  = get(activePage?.buttons ?? {}, `[${x}][${y}]`, EmptyButton(x,y)) // as Button;
        const color =  MakeButtonColor(button.color)
        
        return XYToButton(x,y) !== 35 ? (
          <LaunchpadButton
            x={x}
            y={y}
            color={color}
            keyId={XYToButton(x,y)}
            
            key={`${x}${y}`}
            onContextMenu={onContextMenu}
            onClick={(e) => {
              onButtonPressed(e, x, y, XYToButton(x,y));
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
          >
            SET
          </LaunchpadButton>
        )
      }
      ))}
    </Container>
  )
}

const ColorFromRGB = (color: {[key: string]: number}): [number, number, number] => [color.r / 4, color.g / 4, color.b / 4]

const buildColors = (output: Output, page: Page) => {}

export const Software6x6 = {
  name: "Small 6x6",
  type: ControllerType.Software,
  buildColors,
  XYToButton,
  
  Component,
}