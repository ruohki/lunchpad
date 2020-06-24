import React from 'react';
import lodash from 'lodash';

import webmidi from 'webmidi';

import { LaunchpadButton as Button } from '@lunchpad/base'
import { Page, ControllerType, LaunchpadButton, LaunchpadRGBButtonColor, LaunchpadButtonLook, LaunchpadButtonLookType, LaunchpadButtonLookText, LaunchpadButtonLookImage, LaunchpadButtonColorMode, LaunchpadSolidButtonColor, LaunchpadFlashingButtonColor, LaunchpadPulsingButtonColor, RGBIndexPalette } from '@lunchpad/types'

import { PadContainer, ButtonLook } from '../components';
import { IPadProps, IPad } from '..';

import { MakeButtonColor } from '../helper';

const XYToButton = (x: number, y: number): number => (y === 8) ? 104 + x : (0x70 - (y * 0x10)) + x
const ButtonToXY = (note: number, cc: boolean): [ number, number ] => (cc) ? [ note - 104, 8 ] : [(note % 16), 7 - Math.floor((note / 16)) ]

const Component: React.SFC<IPadProps> = (props) => (
  <PadContainer width={9} height={9}>
    {lodash.reverse(lodash.range(0, 9)).map((y) => lodash.range(0,9).map((x) => {
      const isButton = lodash.get(props.activePage, `buttons.${x}.${y}`, false);
      const button: LaunchpadButton  = lodash.get(props.activePage, `buttons.${x}.${y}`, new LaunchpadButton()) // as Button;
      const color = MakeButtonColor(button.color)
      const { buttonProps } = props;

      return (x === 8 && y === 8) ? (
        <Button
          x={8}
          y={8}
          key="settings"
          note={{ note: 112 }}
          color={"#6a45ff"}
          round
          onContextMenu={() => true}
          onClick={props.onSettingsButtonClick}
          onDrop={lodash.noop}
          canDrag={false}
        >
          SET
        </Button>
      ) : (
        <Button
          x={x}
          y={y}
          color={color}
          note={{ note: XYToButton(x,y) }}
          round={x === 8 || y === 8}
          key={`${x}${y}`}
          {...buttonProps}
          canDrag={isButton}
        >
          <ButtonLook look={button.look} />
        </Button>
      )
    }
    ))}
  </PadContainer>
)

const initialize = (send: (code: number[], data: number[]) => void) => {
  if (!webmidi.enabled) return;
  const outputName = localStorage.getItem('general.midiOutput')
  const output = webmidi.getOutputByName(outputName);
  if (output) {
    output.send(0xB0, [0x0, 0x0])
  }
}

const unload = (send: (code: number[], data: number[]) => void) => {
  if (!webmidi.enabled) return;
  const outputName = localStorage.getItem('general.midiOutput')
  const output = webmidi.getOutputByName(outputName);
  if (output) {
    output.send(0xB0, [0x0, 0x0])
  }
}


const buildColors = (send: (code: number[], data: number[]) => void, page: Page, activeButtons: Array<{x: number, y: number}>) => {
  if (!webmidi.enabled) return;
  const outputName = localStorage.getItem('general.midiOutput')
  const output = webmidi.getOutputByName(outputName);
  if (output) {
    //output.send(0xB0, [0x0, 0x0])
    
    // Reset
    lodash.range(0, 9).map((y) => lodash.range(0,9).map((x) => {
      const button: LaunchpadButton = lodash.get(page, `buttons.${x}.${y}`);
      //console.log(activeButtons, x,y , lodash.some(activeButtons, { x, y }))
      if (button) {
        const isActive = lodash.some(activeButtons, { x, y });
        let color = isActive ? lodash.get(button, 'activeColor', button.color) : button.color
        const btnIdx = XYToButton(x, y);
        if (color.mode !== LaunchpadButtonColorMode.RGB) {
          const index = color.color as number;
          color = new LaunchpadRGBButtonColor(RGBIndexPalette[index])
        }
        const { r, g, b } = LaunchpadRGBButtonColor.getRGB(color as LaunchpadRGBButtonColor);
        // Probably the right colors
        if ((r % 85 === 0) && (g % 85 === 0) && (b === 0)) {
          const brightnessR = Math.round(r / 85)
          const brightnessG = Math.round(g / 85)

          // From the programmers reference manual
          // 0x10 * 0-3 Greens + 0-3 Reds + 0xC Normal LED
          const legacyColor = 0x10 * brightnessG + brightnessR + 0xC
          if (y === 8) {
            // Toprow needs CC
            output.send(0xB0, [ btnIdx, legacyColor ])
          } else {
            output.send(0x90, [ btnIdx, legacyColor ])
          }
        }
      }
    }))
  }
}

export const LaunchpadLegacy: IPad = {
  name: "Legacy Launchpad (MK1, S, Mini MK 1/2)",
  type: ControllerType.Launchpad,
  initialize,
  unload, 
  buildColors,
  XYToButton,
  ButtonToXY,
  Component,
  limitedColor: true
}