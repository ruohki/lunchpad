import * as React from 'react';
import lodash from 'lodash'

import { LaunchpadButton as Button } from '@lunchpad/base'
import { Icon, TriangleUpSolid, TriangleDownSolid, TriangleLeftSolid, TriangleRightSolid, ChevronRight, Circle, TriangleRight, Dash } from '@lunchpad/icons';

import { Page, ControllerType, LaunchpadButton, LaunchpadRGBButtonColor, LaunchpadButtonLook, LaunchpadButtonLookType, LaunchpadButtonLookText, LaunchpadButtonLookImage, LaunchpadButtonColorMode, LaunchpadSolidButtonColor, LaunchpadFlashingButtonColor, LaunchpadPulsingButtonColor } from '@lunchpad/types'

import { PadContainerProMK3, ButtonLook } from '../components';
import { IPadProps, IPad } from '..';

import { MakeButtonColor } from '../helper';

const isClip = (x: number, y: number) => {
  return (x === 0 || x === 9) || (y === 0 || y === 1 || y === 10)
}

const placeholder = [
  0, 9, 100, 109
]


const UpRow = [
  <Icon icon={TriangleUpSolid} />,
  <Icon icon={TriangleDownSolid} />,
  <Icon icon={TriangleLeftSolid} />,
  <Icon icon={TriangleRightSolid} />,
  <span>Session<br />Mixer</span>,
  <span>Note</span>,
  <span>Custom</span>,
  <span style={{ fontSize: "1rem"}}><Icon icon={Circle} /><br />Capture MIDI</span>,
]

const RightRow = [
  <span style={{ fontSize: "1rem"}}><Icon icon={ChevronRight} /><br />Volume</span>,
  <span style={{ fontSize: "1rem"}}><Icon icon={ChevronRight} /><br />Pan</span>,
  <span style={{ fontSize: "1rem"}}><Icon icon={ChevronRight} /><br />Send A</span>,
  <span style={{ fontSize: "1rem"}}><Icon icon={ChevronRight} /><br />Send B</span>,
  <span style={{ fontSize: "1rem"}}><Icon icon={ChevronRight} /><br />Stop Clip</span>,
  <span style={{ fontSize: "1rem"}}><Icon icon={ChevronRight} /><br />Mute</span>,
  <span style={{ fontSize: "1rem"}}><Icon icon={ChevronRight} /><br />Solo</span>,
  <span style={{ fontSize: "1rem"}}><Icon icon={ChevronRight} /><br />Record Arm</span>,
]

const sideButtons = {
  1: <p style={{ fontSize: '0.8rem'}}>Record Arm</p>,
  2: <p style={{ fontSize: '0.8rem'}}>Mute</p>,
  3: <p style={{ fontSize: '0.8rem'}}>Solo</p>,
  4: <p style={{ fontSize: '0.8rem'}}>Volume</p>,
  5: <p style={{ fontSize: '0.8rem'}}>Pan</p>,
  6: <p style={{ fontSize: '0.8rem'}}>Sends</p>,
  7: <p style={{ fontSize: '0.8rem'}}>Device</p>,
  8: <p style={{ fontSize: '0.8rem'}}>Stop Clip</p>,
  
  101: <Icon icon={Dash} />,
  102: <Icon icon={Dash} />,
  103: <Icon icon={Dash} />,
  104: <Icon icon={Dash} />,
  105: <Icon icon={Dash} />,
  106: <Icon icon={Dash} />,
  107: <Icon icon={Dash} />,
  108: <Icon icon={Dash} />,

  80: <Icon icon={TriangleUpSolid} />,
  70: <Icon icon={TriangleDownSolid} />,
  60: <p style={{ fontSize: "0.9rem"}}>Clear</p>,
  50: <p style={{ fontSize: "0.9rem", lineHeight: '2rem'}}>Duplicate<br /><span style={{ fontSize: "0.6rem", lineHeight: "2rem"}}>Double</span></p>,
  40: <span style={{ fontSize: '1rem'}}>Quantise</span>,
  30: <span style={{ fontSize: '1rem'}}>Fixed Lenght</span>,
  20: <Icon icon={TriangleRight} />,
  10: <><Icon icon={Circle} /><p style={{ fontSize: "0.8rem", lineHeight: '1rem'}}>Capture MIDI</p></>,
  
  91: <Icon icon={TriangleLeftSolid} />,
  92: <Icon icon={TriangleRightSolid} />,
  93: <span style={{ fontSize: '1rem'}}>Session</span>,
  94: <span style={{ fontSize: '1rem'}}>Note</span>,
  95: <span style={{ fontSize: '1rem'}}>Chord</span>,
  96: <span style={{ fontSize: '1rem'}}>Custom</span>,
  97: <span style={{ fontSize: '1rem'}}>Sequencer</span>,
  98: <p style={{ fontSize: "0.9rem", lineHeight: '2rem'}}>Projects<br /><span style={{ fontSize: "0.6rem", lineHeight: "2rem"}}>Save</span></p>,
  
  19: <><Icon icon={ChevronRight} /><p style={{ fontSize: "0.8rem", lineHeight: '0.7rem'}}>Print to clip</p></>,
  29: <><Icon icon={ChevronRight} /><p style={{ fontSize: "0.8rem", lineHeight: '0.7rem'}}>Micro-step</p></>,
  39: <><Icon icon={ChevronRight} /><p style={{ fontSize: "0.8rem", lineHeight: '0.7rem'}}>Mutation</p></>,
  49: <><Icon icon={ChevronRight} /><p style={{ fontSize: "0.8rem", lineHeight: '0.7rem'}}>Probablity</p></>,
  59: <><Icon icon={ChevronRight} /><p style={{ fontSize: "0.8rem", lineHeight: '0.7rem'}}>Velocity</p></>,
  69: <><Icon icon={ChevronRight} /><p style={{ fontSize: "0.8rem", lineHeight: '0.9rem'}}>Patterns Settings</p></>,
  79: <><Icon icon={ChevronRight} /><p style={{ fontSize: "0.8rem", lineHeight: '0.7rem'}}>Steps</p></>,
  89: <><Icon icon={ChevronRight} /><p style={{ fontSize: "0.8rem", lineHeight: '0.7rem'}}>Patterns</p></>,
}

const Vendor = [0x0, 0x20, 0x29];
const Mode = [0x02, 0x0E, 0x0E, 0x01];

const Unload = [0x02, 0x0E, 0x0E, 0x00];

const Color = [0x02, 0x0E, 0x3];

const XYToButton = (x: number, y: number): number => {
  if (y === 1) return 100 + x
  if (y > 1) return (y - 1) * 10 + x
  return  y * 10 + x
}
const ButtonToXY = (note: number): [ number, number ] => {
  if (note > 100 && note <= 108) return [ note % 10, 1 ]
  else if (note > 9) return [(note % 10), Math.floor(note / 10) + 1]
  else return [(note % 10), 0]
}

console.log(...ButtonToXY(98))
const Component: React.SFC<IPadProps> = (props) => (
  <PadContainerProMK3>
    {lodash.reverse(lodash.range(0, 11)).map((y) => lodash.range(0,10).map((x) => {
      const isButton = lodash.get(props.activePage, `buttons.${x}.${y}`, false);
      const button: LaunchpadButton  = lodash.get(props.activePage, `buttons.${x}.${y}`, new LaunchpadButton()) // as Button;
      const color = MakeButtonColor(button.color)
      const { buttonProps } = props;

      return lodash.includes(placeholder, XYToButton(x,y)) ? <div key={XYToButton(x,y)} /> : XYToButton(x,y) !== 99 ? (
        <Button
          x={x}
          y={y}
          small={XYToButton(x,y) === 90}
          margin="2px"
          color={color}
          note={{ note: XYToButton(x,y) }}
          clip={isClip(x, y)}
          key={`${x}${y}`}
          {...buttonProps}
          canDrag={isButton}
        >
          {/* {x}/{y}-{XYToButton(x,y)} */}
          {isClip(x,y) ? props.showIcons ? sideButtons[XYToButton(x,y)] : <ButtonLook look={button.look} /> : <ButtonLook look={button.look} /> }
        </Button>
      ) : (
        <Button
          x={8}
          y={8}
          margin="2px"
          key="settings"
          note={{ note: 112 }}
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
  </PadContainerProMK3>
)

const initialize = (send: (code: number[], data: number[]) => void) => {
  // Switch to programmers mode
  send(Vendor, Mode);
}

const unload = (send: (code: number[], data: number[]) => void) => {
  // Switch to programmers mode
  send(Vendor, Unload);
}

const buildColors = (send: (code: number[], data: number[]) => void, page: Page, activeButtons: Array<{x: number, y: number}>) => {
  
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

export const LaunchpadProMK3: IPad = {
  name: "Launchpad Pro MK3",
  type: ControllerType.Launchpad,
  initialize,
  unload,
  buildColors,
  XYToButton,
  ButtonToXY,
  Component,
  limitedColor: false
}