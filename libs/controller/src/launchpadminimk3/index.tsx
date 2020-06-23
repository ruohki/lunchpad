import * as React from 'react';
import lodash from 'lodash'

import { LaunchpadButton as Button } from '@lunchpad/base'
import { 
  Icon, 
  ChevronRight, 
  TriangleUpSolid, 
  TriangleDownSolid, 
  TriangleLeftSolid, 
  TriangleRightSolid
} from '@lunchpad/icons';

import { Page, ControllerType, LaunchpadButton, LaunchpadRGBButtonColor, LaunchpadButtonLook, LaunchpadButtonLookType, LaunchpadButtonLookText, LaunchpadButtonLookImage, LaunchpadButtonColorMode, LaunchpadSolidButtonColor, LaunchpadFlashingButtonColor, LaunchpadPulsingButtonColor } from '@lunchpad/types'

import { PadContainer, ButtonLook } from '../components';
import { XYToButton, ButtonToXY } from './helper'
import { IPadProps, IPad } from '..';

import { MakeButtonColor } from '../helper';

const UpRow = [
  <Icon icon={TriangleUpSolid} />,
  <Icon icon={TriangleDownSolid} />,
  <Icon icon={TriangleLeftSolid} />,
  <Icon icon={TriangleRightSolid} />,
  <span>Session</span>,
  <span>Drums</span>,
  <span>Keys</span>,
  <span>User</span>
]

const RightRow = [
  <Icon icon={ChevronRight} />,
  <Icon icon={ChevronRight} />,
  <Icon icon={ChevronRight} />,
  <Icon icon={ChevronRight} />,
  <Icon icon={ChevronRight} />,
  <Icon icon={ChevronRight} />,
  <Icon icon={ChevronRight} />,
  <p style={{ lineHeight: '1.4rem', fontSize: '1.4rem'}}>Stop Solo Mute</p>
]

const Vendor = [0x0, 0x20, 0x29];
const Mode = [0x2, 0xD, 0x0, 0x7F];
const Unload = [0x2, 0xD, 0x0, 0x04];

const Color = [0x2, 0xD, 0x3];

const Component: React.SFC<IPadProps> = ({ onDragStart, onDragEnd, showIcons, onDrop, onButtonPressed, onButtonReleased, onContextMenu, onSettingsButtonClick, activePage }) => {
  return (
    <PadContainer width={9} height={9}>
      {lodash.reverse(lodash.range(0, 9)).map((y) => lodash.range(0,9).map((x) => {
        const isButton = lodash.get(activePage, `buttons.${x}.${y}`, false);
        const button: LaunchpadButton  = lodash.get(activePage, `buttons.${x}.${y}`, new LaunchpadButton()) // as Button;
        const color = MakeButtonColor(button.color)
        return XYToButton(x,y) !== 99 ? (
          <Button
            x={x}
            y={y}
            color={color}
            keyId={XYToButton(x,y)}
            clip={showIcons && (x === 8 || y === 8)}
            key={`${x}${y}`}
            onContextMenu={onContextMenu}
            onMouseDown={(e) => onButtonPressed(e, x, y, XYToButton(x,y), false)}
            onMouseUp={(e) => onButtonReleased(e, x, y, XYToButton(x,y), false)}
            onDrop={onDrop}
            canDrag={isButton}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          >
            {!showIcons ? <ButtonLook look={button.look} /> : x === 8 || y === 8 ? x === 8 ? RightRow[7 - y] : UpRow[x] : <ButtonLook look={button.look} />}
          </Button>
        ) : (
          <Button
            x={8}
            y={8}
            key="settings"
            keyId={112}
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

const initialize = (send: (code: number[], data: number[]) => void) => {
  // Switch to programmers mode
  send(Vendor, Mode);
}

const unload = (send: (code: number[], data: number[]) => void) => {
  // Switch to programmers mode
  send(Vendor, Unload);
}

const buildColors = (send: (code: number[], data: number[]) => void, page: Page, activeButtons: Array<{x: number, y: number}>) => {
  // Build color array
  const colors = lodash.flattenDeep(lodash.range(0, 9).map((y) => lodash.range(0,9).map((x) => {
    const button: LaunchpadButton = lodash.get(page, `buttons.${x}.${y}`);
    //console.log(activeButtons, x,y , lodash.some(activeButtons, { x, y }))
    if (button) {
      const isActive = lodash.some(activeButtons, { x, y });

      let color = isActive ? lodash.get(button, 'activeColor', button.color) : button.color

      const btnIdx = XYToButton(x, y);
      switch (color.mode) {
        case LaunchpadButtonColorMode.Static:
          return [0, btnIdx, (color as LaunchpadSolidButtonColor).color];
        case LaunchpadButtonColorMode.Flashing:
          return [1, btnIdx, (color as LaunchpadFlashingButtonColor).color, (color as LaunchpadFlashingButtonColor).alt];
        case LaunchpadButtonColorMode.Pulsing:
          return [2, btnIdx, (color as LaunchpadPulsingButtonColor).color];
        case LaunchpadButtonColorMode.RGB:
          const { r, g, b } = LaunchpadRGBButtonColor.getRGB(color as LaunchpadRGBButtonColor);
          return [3, btnIdx, Math.floor(r / 2), Math.floor(g / 2), Math.floor(b / 2)]
        default:
          return [0, btnIdx, 0]
      }
    } else {
      // Clear the button or if its top right make it fade
      return x === 8 && y === 8 ? [2, 99, 45] : [0, XYToButton(x,y), 0]
    }
  })))

  // Set the whole board
  send(Vendor, [...Color, ...colors]);
}

export const LaunchpadMiniMK3: IPad = {
  name: "Launchpad Mini MK3",
  type: ControllerType.Launchpad,
  buildColors,
  initialize,
  unload,
  XYToButton,
  ButtonToXY,
  Component,
  limitedColor: false
}