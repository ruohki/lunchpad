import React from 'react';
import { Output } from 'webmidi'

import range from 'lodash/range';
import reverse from 'lodash/reverse';
import get from 'lodash/get';
import flatten from 'lodash/flattenDeep';

import { LaunchpadButton, Tooltip } from '@lunchpad/base'
import { IconCaretRight, IconCaretUpSolid, IconCaretDownSolid, IconCaretLeftSolid, IconCaretRightSolid } from '@lunchpad/icons';
import { LayoutContext, MidiContext } from '@lunchpad/contexts'
import { Page } from '@lunchpad/types'

import { Container } from './components';
import { XYToButton, ButtonToXY, MakeButtonColor } from './helper'

interface LaunchpadProps {
  activePage: Page
  onButtonPressed: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>, x: number, y: number, note: number) => void
  onContextMenu: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>, x: number, y: number, note: number) => void
  onSettingsButtonClick: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void
}

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
const Color = [0x2, 0x18, 0x0B];

const Component: React.SFC<LaunchpadProps> = ({ onButtonPressed, onContextMenu, onSettingsButtonClick, activePage }) => {
  
  return (
    <Container>
      {reverse(range(0, 9)).map((y) => range(0,9).map((x) => {
        const button  = get(activePage?.buttons ?? {}, `[${x}][${y}]`, EmptyButton(x,y)) // as Button;
        const color = MakeButtonColor(button.color)
        
        return XYToButton(x,y) !== 112 ? (
          <LaunchpadButton
            x={x}
            y={y}
            color={color}
            keyId={XYToButton(x,y)}
            round={x === 8 || y === 8}
            clip={x === 8 || y === 8}
            key={`${x}${y}`}
            onContextMenu={onContextMenu}
            onClick={(e) => {
              onButtonPressed(e, x, y, XYToButton(x,y));
            }}
          >
            {x === 8 || y === 8 ? x === 8 ? RightRow[7 - y] : UpRow[x] : button.title}
          </LaunchpadButton>
        ) : (
          <LaunchpadButton
            x={8}
            y={8}
            key="settings"
            keyId={112}
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

const buildColors = (output: Output, page: Page) => {
  if (!output) return;
  output.sendSysex(Vendor, Mode);
  const colors = flatten(Object.keys(page.buttons).map(x => {
    return Object.keys(page.buttons[x]).map(y => {
      const { r, g, b } = page.buttons[parseInt(x)][parseInt(y)].color;
      return [XYToButton(parseInt(x),parseInt(y)), r, g, b]
    })
  }))
  output.sendSysex(Vendor, [...Color, ...colors]);
}

export const LaunchpadMK2 = {
  buildColors,
  Name: "Launchpad MK2",
  ColorFromRGB,
  Vendor: [0x0, 0x20, 0x29],
  Mode: [0x2, 0x18, 0x22, 0x0],
  Color: [0x2, 0x18, 0x0B],
  XYToButton,
  ButtonToXY,

  Component,
}