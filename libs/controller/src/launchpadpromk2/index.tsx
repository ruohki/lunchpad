import React from 'react';
import { Output } from 'webmidi'

import * as lodash from 'lodash';

import { LaunchpadButton } from '@lunchpad/base'
import { IconCaretRight, IconCaretUpSolid, IconCaretDownSolid, IconCaretLeftSolid, IconCaretRightSolid, IconCircle } from '@lunchpad/icons';
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

const UpRow = [
  <IconCaretUpSolid />,
  <IconCaretDownSolid />,
  <IconCaretLeftSolid />,
  <IconCaretRightSolid />,
  <span>Session</span>,
  <span>User 1</span>,
  <span>User 2</span>,
  <span>Mixer</span>,
]

const RightRow = [
  <IconCaretRight />,
  <IconCaretRight />,
  <IconCaretRight />,
  <IconCaretRight />,
  <IconCaretRight />,
  <IconCaretRight />,
  <IconCaretRight />,
  <IconCaretRight />
]

const Vendor = [0x0, 0x20, 0x29];
const Mode = [0x2, 0x18, 0x22, 0x0];
const Programmer = []
const Color = [0x2, 0x18, 0x0B];

const isRound = (x: number, y: number) => {
  return (x === 0 || x === 9) || (y === 0 || y === 9) 
}

const placeholder = [
  0, 9, 90
]

const sideButtons = {
  1: <span style={{ fontSize: '1.4rem'}}>Record Arm</span>,
  2: <span style={{ fontSize: '1.4rem'}}>Track Select</span>,
  3: <span>Mute</span>,
  4: <span>Solo</span>,
  5: <span style={{ fontSize: '1.4rem'}}>Volume</span>,
  6: <span>Pan</span>,
  7: <span>Sends</span>,
  8: <span style={{ fontSize: '1.5rem'}}>Stop Clip</span>,
  
  80: <span>Shift</span>,
  70: <span>Click</span>,
  60: <span>Undo</span>,
  50: <span>Delete</span>,
  40: <span style={{ fontSize: '1.3rem'}}>Quantise</span>,
  30: <span style={{ fontSize: '1.2rem'}}>Duplicate</span>,
  20: <span>Double</span>,
  10: <span><IconCircle /></span>,
  
  91: <IconCaretUpSolid />,
  92: <IconCaretDownSolid />,
  93: <IconCaretLeftSolid />,
  94: <IconCaretRightSolid />,
  95: <span>Session</span>,
  96: <span>Note</span>,
  97: <span>Device</span>,
  98: <span>User</span>,
  
  19: <IconCaretRight />,
  29: <IconCaretRight />,
  39: <IconCaretRight />,
  49: <IconCaretRight />,
  59: <IconCaretRight />,
  69: <IconCaretRight />,
  79: <IconCaretRight />,
  89: <IconCaretRight />,
}

const Component: React.SFC<IPadProps> = ({
  onButtonPressed,
  onContextMenu,
  onSettingsButtonClick,
  activePage,
  onDrop,
}) => {
  return (
    <PadContainer width={10} height={10}>
      {lodash.reverse(lodash.range(0, 10)).map((y) => lodash.range(0,10).map((x) => {
        const button  = lodash.get(activePage?.buttons ?? {}, `[${x}][${y}]`, EmptyButton(x,y)) // as Button;
        const color = MakeButtonColor(button.color)
        
        return lodash.includes(placeholder, XYToButton(x,y)) ? <div key={XYToButton(x,y)} /> : XYToButton(x,y) !== 99 ? (
          <LaunchpadButton
            x={x}
            y={y}
            color={color}
            keyId={XYToButton(x,y)}
            round={isRound(x,y)}
            clip={isRound(x,y)}
            key={`${x}${y}`}
            onContextMenu={onContextMenu}
            onClick={(e) => {
              onButtonPressed(e, x, y, XYToButton(x,y), false);
            }}
            onDrop={onDrop}
          >
            {isRound(x,y) ? sideButtons[XYToButton(x,y)] : button.title}
          </LaunchpadButton>
        ) : (
          <LaunchpadButton
            x={9}
            y={9}
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
        )
      }
      ))}
    </PadContainer>
  )
}

const ColorFromRGB = (color: {[key: string]: number}): [number, number, number] => [color.r / 4, color.g / 4, color.b / 4]

const buildColors = (output: Output, page: Page) => {
  if (!output) return;
  output.sendSysex(Vendor, Mode);
  const colors = lodash.flattenDeep(Object.keys(page.buttons).map(x => {
    return Object.keys(page.buttons[x]).map(y => {
      const { r, g, b } = page.buttons[parseInt(x)][parseInt(y)].color;
      // RGB / 4 for MK2
      return [XYToButton(parseInt(x),parseInt(y)), Math.floor(r / 4), Math.floor(g / 4), Math.floor(b / 4)]
    })
  }))
  output.sendSysex(Vendor, [...Color, ...colors]);
}

export const LaunchpadProMK2 = {
  name: "Launchpad Pro MK2",
  type: ControllerType.Launchpad,
  buildColors,
  XYToButton,
  ButtonToXY,
  Component,
  limitedColor: false
}