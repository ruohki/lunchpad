import React from 'react';
import { Output } from 'webmidi'

import * as _ from 'lodash'


import { LaunchpadButton } from '@lunchpad/base'
import { IconChevronRight, IconCaretUpSolid, IconCaretDownSolid, IconCaretLeftSolid, IconCaretRightSolid } from '@lunchpad/icons';

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
  <span>Drums</span>,
  <span>Keys</span>,
  <span>User</span>
]

const RightRow = [
  <IconChevronRight />,
  <IconChevronRight />,
  <IconChevronRight />,
  <IconChevronRight />,
  <IconChevronRight />,
  <IconChevronRight />,
  <IconChevronRight />,
  <span>Stop Solo Mute</span>
]

const Vendor = [0x0, 0x20, 0x29];
const Mode = [0x2, 0x0D, 0x0, 0x7F] //, []];
const Color = [0x2, 0xD, 0x3];

const Component: React.SFC<LaunchpadProps> = ({ onButtonPressed, onContextMenu, onSettingsButtonClick, activePage }) => {
  
  return (
    <Container>
      {_.reverse(_.range(0, 9)).map((y) => _.range(0,9).map((x) => {
        const button  = _.get(activePage?.buttons ?? {}, `[${x}][${y}]`, EmptyButton(x,y)) // as Button;
        const color = MakeButtonColor(button.color)
        
        return XYToButton(x,y) !== 99 ? (
          <LaunchpadButton
            x={x}
            y={y}
            color={color}
            keyId={XYToButton(x,y)}
            
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

// conversion from full rgb to MiniMK3 rgb = / 2 | max 127
const ColorFromRGB = (color: {[key: string]: number}): [number, number, number] => [color.r / 2, color.g / 2, color.b / 2]

const buildColors = (output: Output, page: Page) => {
  if (!output) return;
  // Switch to programmers mode
  output.sendSysex(Vendor, [0x2, 0xD, 0x0, 0x7F]);

  // Clear Pad
  const clear = _.flatten(_.range(11, 11+89).map(i => (i === 99 ? [2, 99, 45] : [0, i, 0])))
  output.sendSysex(Vendor, [...Color, ...clear])
  
  // Build color array
  const colors = _.flattenDeep(Object.keys(page.buttons).map(x => {
    return Object.keys(page.buttons[x]).map(y => {
      const { r, g, b } = page.buttons[parseInt(x)][parseInt(y)].color;
      return [3, XYToButton(parseInt(x),parseInt(y)), r, g, b]
    })
  }))

  // Set colors
  output.sendSysex(Vendor, [...Color, ...colors]);
}

export const LaunchpadMiniMK3 = {
  Name: "MIDIIN2 (LPMiniMK3 MIDI)",
  buildColors,
  XYToButton,
  ButtonToXY,
  Component,
}