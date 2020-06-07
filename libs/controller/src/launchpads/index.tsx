import React from 'react';
import { Output } from 'webmidi'

import range from 'lodash/range';
import reverse from 'lodash/reverse';
import get from 'lodash/get';
import flatten from 'lodash/flattenDeep';

import { LaunchpadButton } from '@lunchpad/base'
import { Page, ControllerType } from '@lunchpad/types'

import { PadContainer } from '../components';
import { XYToButton, ButtonToXY, MakeButtonColor } from './helper'
import { IPadProps } from '..';

const EmptyButton = (x, y) => ({
  title: "",
  x,
  y,
  color: {r: 0, g: 0, b: 0}
})

const Component: React.SFC<IPadProps> = ({
  onButtonPressed,
  onContextMenu,
  onSettingsButtonClick,
  activePage,
  onDrop,
}) => {
  return (
    <PadContainer width={9} height={9}>
      {reverse(range(0, 9)).map((y) => range(0,9).map((x) => {
        const button  = get(activePage?.buttons ?? {}, `[${x}][${y}]`, EmptyButton(x,y)) // as Button;
        const color = MakeButtonColor(button.color)
        
        return (x === 8 && y === 8) ? (
          <LaunchpadButton
            x={8}
            y={8}
            key="settings"
            keyId={112}
            color={"#6a45ff"}
            round
            onContextMenu={() => true}
            onClick={onSettingsButtonClick}
            onDrop={() => {}}
          >
            SET
          </LaunchpadButton>
        ) : (
          <LaunchpadButton
            x={x}
            y={y}
            color={color}
            keyId={XYToButton(x,y)}
            round={x === 8 || y === 8}
            key={`${x}${y}`}
            onContextMenu={onContextMenu}
            onClick={(e) => {
              onButtonPressed(e, x, y, XYToButton(x,y), y === 8);
            }}
            onDrop={onDrop}
          >
            {button.title}
          </LaunchpadButton>
          
        )
      }
      ))}
    </PadContainer>
  )
}

const buildColors = (output: Output, page: Page) => {
  if (!output) return;

  // Reset
  output.send(0xB0, [0x0, 0x0])
  Object.keys(page.buttons).forEach(x => {
    Object.keys(page.buttons[x]).forEach(y => {
      const { r, g, b } = page.buttons[parseInt(x)][parseInt(y)].color;
      // Probably the right colors
      if ((r % 85 === 0) && (g % 85 === 0) && (b === 0)) {
        const brightnessR = r / 85
        const brightnessG = g / 85

        // From the programmers reference manual
        // 0x10 * 0-3 Greens + 0-3 Reds + 0xC Normal LED
        const color = 0x10 * brightnessG + brightnessR + 0xC
        if (parseInt(y) === 8) {
          // Toprow needs CC
          output.send(0xB0, [ XYToButton(parseInt(x),parseInt(y)), color ])
        } else {
          output.send(0x90, [ XYToButton(parseInt(x),parseInt(y)), color ])
        }
      } else {
        // Invalid color - make it red then
        if (parseInt(y) === 8) {
          // Toprow needs CC
          output.send(0xB0, [ XYToButton(parseInt(x),parseInt(y)), 0x0F ])
        } else {
          output.send(0x90, [ XYToButton(parseInt(x),parseInt(y)), 0x0F ])
        }
      }
    })
  })
}

export const LaunchpadLegacy = {
  name: "Legacy Launchpad (MK1, S, Mini MK 1/2)",
  type: ControllerType.Launchpad,
  buildColors,
  XYToButton,
  ButtonToXY,
  Component,
  limitedColor: true
}