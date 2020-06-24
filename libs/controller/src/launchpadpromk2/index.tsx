import React from 'react';
import lodash from 'lodash';

import { LaunchpadButton as Button } from '@lunchpad/base'
import { TriangleRight, TriangleUpSolid, Circle, TriangleDownSolid, TriangleLeftSolid, TriangleRightSolid, Icon } from '@lunchpad/icons';
import { Page, ControllerType, LaunchpadButton, LaunchpadRGBButtonColor, LaunchpadButtonLook, LaunchpadButtonLookType, LaunchpadButtonLookText, LaunchpadButtonLookImage, LaunchpadButtonColorMode, LaunchpadSolidButtonColor, LaunchpadFlashingButtonColor, LaunchpadPulsingButtonColor } from '@lunchpad/types'

import { PadContainer, ButtonLook } from '../components';
import { XYToButton, ButtonToXY } from './helper'
import { IPadProps, IPad } from '..';

import { MakeButtonColor } from '../helper';

const Vendor = [0x0, 0x20, 0x29];
const Mode = [0x2, 0x10, 0x21, 0x0];
const Programmer = [0x2, 0x10, 0x22, 0x0];

const Solid = [0x2, 0x10, 0x0A];
const Flashing = [0x2, 0x10, 0x23];
const Pulsing = [0x2, 0x10, 0x28];
const RGB = [0x2, 0x10, 0x0B];

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
  10: <span><Icon  icon={Circle} /></span>,
  
  91: <Icon icon={TriangleUpSolid} />,
  92: <Icon icon={TriangleDownSolid} />,
  93: <Icon icon={TriangleLeftSolid} />,
  94: <Icon icon={TriangleRightSolid} />,
  95: <span>Session</span>,
  96: <span>Note</span>,
  97: <span>Device</span>,
  98: <span>User</span>,
  
  19: <Icon icon={TriangleRight} />,
  29: <Icon icon={TriangleRight} />,
  39: <Icon icon={TriangleRight} />,
  49: <Icon icon={TriangleRight} />,
  59: <Icon icon={TriangleRight} />,
  69: <Icon icon={TriangleRight} />,
  79: <Icon icon={TriangleRight} />,
  89: <Icon icon={TriangleRight} />,
}

const Component: React.SFC<IPadProps> = (props) => (
  <PadContainer width={10} height={10}>
    {lodash.reverse(lodash.range(0, 10)).map((y) => lodash.range(0,10).map((x) => {
      const isButton = lodash.get(props.activePage, `buttons.${x}.${y}`, false);
      const button: LaunchpadButton  = lodash.get(props.activePage, `buttons.${x}.${y}`, new LaunchpadButton()) // as Button;
      const color = MakeButtonColor(button.color)
      const { buttonProps } = props;

      return lodash.includes(placeholder, XYToButton(x,y)) ? <div key={XYToButton(x,y)} /> : XYToButton(x,y) !== 99 ? (
        <Button
          x={x}
          y={y}
          color={color}
          note={{ note: XYToButton(x,y)}}
          round={isRound(x,y)}
          clip={isRound(x,y)}
          key={`${x}${y}`}
          {...buttonProps}
          canDrag={isButton}
        >
          {isRound(x,y) ? props.showIcons ? sideButtons[XYToButton(x,y)] : <ButtonLook look={button.look} /> : <ButtonLook look={button.look} /> }
        </Button>
      ) : (
        <Button
          x={9}
          y={9}
          key="settings"
          note={{ note: 99 }}
          color={"#6a45ff"}
          round
          onContextMenu={lodash.noop}
          onClick={props.onSettingsButtonClick}
          canDrag={false}
        >
          SET
        </Button>
      )
    }
    ))}
  </PadContainer>
)

const initialize = (send: (code: number[], data: number[]) => void) => {
  send(Vendor, Mode);
  send(Vendor, Programmer);
  send(Vendor, [0x2, 0x10, 0x0E, 0x0]);
}

const unload = (send: (code: number[], data: number[]) => void) => {
/*   send(Vendor, Clear);
  send(Vendor, Unload); */
}


const buildColors = (send: (code: number[], data: number[]) => void, page: Page, activeButtons: Array<{x: number, y: number}>) => {
  let solids = new Array<number>();
  let flashing = new Array<number>();
  let pulsing = new Array<number>();
  let rgb = new Array<number>();

  // Build color array
  lodash.range(0, 10).map((y) => lodash.range(0,10).map((x) => {
    const button: LaunchpadButton = lodash.get(page, `buttons.${x}.${y}`);
    //console.log(activeButtons, x,y , lodash.some(activeButtons, { x, y }))
    if (button) {
      const isActive = lodash.some(activeButtons, { x, y });

      let color = isActive ? lodash.get(button, 'activeColor', button.color) : button.color

      const btnIdx = XYToButton(x, y);
      switch (color.mode) {
        case LaunchpadButtonColorMode.Static:
          solids.push(btnIdx, (color as LaunchpadSolidButtonColor).color);
          break;
        case LaunchpadButtonColorMode.Flashing:
          solids.push(btnIdx, (color as LaunchpadFlashingButtonColor).color)
          flashing.push(0, btnIdx, (color as LaunchpadFlashingButtonColor).alt);
          break;
        case LaunchpadButtonColorMode.Pulsing:
          pulsing.push(0, btnIdx, (color as LaunchpadPulsingButtonColor).color)
          break;
        case LaunchpadButtonColorMode.RGB:
          const { r, g, b } = LaunchpadRGBButtonColor.getRGB(color as LaunchpadRGBButtonColor);
          rgb.push(btnIdx, Math.floor(r / 4), Math.floor(g / 4), Math.floor(b / 4))
          break;
        default:
          solids.push(btnIdx, 0)
      }
    } else {
      // Clear the button or if its top right make it fade
      solids.push(XYToButton(x,y), 0)
    }
  }))

  if (solids.length > 0) {
    const colors = lodash.chunk(solids, 77);
    const [ part1 = [], part2 = [] ] = colors;

    if (part1.length > 0) send(Vendor, [...Solid, ...part1]);
    if (part2.length > 0) send(Vendor, [...Solid, ...part2]);
  }
  if (flashing.length > 0) {
    const colors = lodash.chunk(flashing, 77);
    const [ part1 = [], part2 = [] ] = colors;

    if (part1.length > 0) send(Vendor, [...Flashing, ...part1]);
    if (part2.length > 0) send(Vendor, [...Flashing, ...part2]);
  }
  if (pulsing.length > 0) {
    const colors = lodash.chunk(pulsing, 77);
    const [ part1 = [], part2 = [] ] = colors;

    if (part1.length > 0) send(Vendor, [...Pulsing, ...part1]);
    if (part2.length > 0) send(Vendor, [...Pulsing, ...part2]);
  }
  if (rgb.length > 0) {
    const colors = lodash.chunk(rgb, 77);
    const [ part1 = [], part2 = [] ] = colors;

    if (part1.length > 0) send(Vendor, [...RGB, ...part1]);
    if (part2.length > 0) send(Vendor, [...RGB, ...part2]);
  }
}

export const LaunchpadProMK2: IPad = {
  name: "Launchpad Pro MK2",
  type: ControllerType.Launchpad,
  initialize,
  unload,
  buildColors,
  XYToButton,
  ButtonToXY,
  Component,
  limitedColor: false
}