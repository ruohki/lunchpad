import React from 'react';
import { Output } from 'webmidi'

import range from 'lodash/range';
import reverse from 'lodash/reverse';
import get from 'lodash/get';
import flatten from 'lodash/flattenDeep';

import { LaunchpadButton, Tooltip } from '@lunchpad/base'
import { Icon, TriangleRight, TriangleUpSolid, TriangleDownSolid, TriangleLeftSolid, TriangleRightSolid } from '@lunchpad/icons';
import { LayoutContext, MidiContext } from '@lunchpad/contexts'
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
  <Icon icon={TriangleUpSolid} />,
  <Icon icon={TriangleDownSolid} />,
  <Icon icon={TriangleLeftSolid} />,
  <Icon icon={TriangleRightSolid} />,
  <span>Session</span>,
  <span>User 1</span>,
  <span>User 2</span>,
  <span>Mixer</span>,
]

const RightRow = [
  <Icon icon={TriangleRight} />,
  <Icon icon={TriangleRight} />,
  <Icon icon={TriangleRight} />,
  <Icon icon={TriangleRight} />,
  <Icon icon={TriangleRight} />,
  <Icon icon={TriangleRight} />,
  <Icon icon={TriangleRight} />,
  <Icon icon={TriangleRight} />,
]

const Vendor = [0x0, 0x20, 0x29];
const Mode = [0x2, 0x18, 0x22, 0x0];
const Color = [0x2, 0x18, 0x0B];

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
              onButtonPressed(e, x, y, XYToButton(x,y), false);
            }}
            onDrop={onDrop}
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
  const colors = flatten(Object.keys(page.buttons).map(x => {
    return Object.keys(page.buttons[x]).map(y => {
      const { r, g, b } = page.buttons[parseInt(x)][parseInt(y)].color;
      // RGB / 4 for MK2
      return [XYToButton(parseInt(x),parseInt(y)), Math.floor(r / 4), Math.floor(g / 4), Math.floor(b / 4)]
    })
  }))
  output.sendSysex(Vendor, [...Color, ...colors]);
}

export const LaunchpadMK2 = {
  name: "Launchpad MK2",
  type: ControllerType.Launchpad,
  buildColors,
  XYToButton,
  ButtonToXY,
  Component,
  limitedColor: false
}