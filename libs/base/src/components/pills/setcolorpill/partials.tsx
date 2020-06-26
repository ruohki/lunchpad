import * as React from 'react';
import styled from 'styled-components';

import { LaunchpadSolidButtonColor, LaunchpadFlashingButtonColor, LaunchpadPulsingButtonColor, LaunchpadRGBButtonColor, LaunchpadButtonColor, LaunchpadButtonColorMode } from '@lunchpad/types';

import { Row, Split, Child } from '../../basic/layout';
import { Button } from '../../basic/button';
import { Palettes, IndexPillPicker, FullPillPicker, StyledCircle } from '../../colorpicker'
import { darken } from 'polished';


interface IColorDisplay {
  color: string
}
const ColorDisplay = styled.div<IColorDisplay>`
border-radius: 3px;
  display: inline-block;
  margin-left: 2rem;
  width: 6rem;
  height: 1rem;
  background-color: ${props => props.color};
  border: 2px solid ${props => darken(0.1, props.color)};
`

interface IColorPreview {
  color: LaunchpadButtonColor
}

export const PillColorPreview: React.SFC<IColorPreview> = (props) => {
  switch (props.color.mode) {
    case LaunchpadButtonColorMode.Static:
      return <ColorDisplay color={Palettes.Indexed[(props.color as LaunchpadSolidButtonColor).color]} />
    case LaunchpadButtonColorMode.Flashing:
      return <><ColorDisplay color={Palettes.Indexed[(props.color as LaunchpadFlashingButtonColor).color]} /><ColorDisplay color={Palettes.Indexed[(props.color as LaunchpadFlashingButtonColor).alt]} /></>
    case LaunchpadButtonColorMode.Pulsing:
      return <ColorDisplay color={Palettes.Indexed[(props.color as LaunchpadPulsingButtonColor).color]} />
    case LaunchpadButtonColorMode.RGB:
      return <ColorDisplay color={(props.color as LaunchpadRGBButtonColor).color} />
  }
}

interface ILaunchpadButtonSolidColorComponent {
  color: LaunchpadSolidButtonColor
  onChangeColor: (color: number) => void
  showContextMenu: (x: number, y: number, component: JSX.Element, width?: number, height?: number) => void
}

export const LaunchpadButtonSolidColorComponent: React.SFC<ILaunchpadButtonSolidColorComponent> = (props) => (
  <Row title="Color:">
    <Split direction="row">
      <Child basis="50%" padding="0 0.5rem 0 0">
        <IndexPillPicker
          showContextMenu={props.showContextMenu}
          color={Palettes.Indexed[props.color.color] ?? '#000000'}
          onChange={c => props.onChangeColor(Palettes.Indexed.indexOf(c.hex))}
        />
      </Child>
    </Split>
  </Row>
)

interface ILaunchpadButtonFlashingColorComponent {
  color: LaunchpadFlashingButtonColor
  onChangeColorA: (color: number) => void
  onChangeColorB: (color: number) => void
  showContextMenu: (x: number, y: number, component: JSX.Element, width?: number, height?: number) => void
}

export const LaunchpadButtonFlashingColorComponent: React.SFC<ILaunchpadButtonFlashingColorComponent> = (props) => (
  <Row title="Color:">
    <Split direction="row">
      <Child basis="50%" padding="0 0.5rem 0 0">
        <IndexPillPicker
          showContextMenu={props.showContextMenu}
          color={Palettes.Indexed[props.color.color] ?? '#000000'}
          onChange={c => props.onChangeColorA(Palettes.Indexed.indexOf(c.hex))}
        />
      </Child>
      <Child basis="50%" padding="0 0 0 0.5rem">
        <IndexPillPicker
          showContextMenu={props.showContextMenu}
          color={Palettes.Indexed[props.color.alt] ?? '#000000'}
          onChange={c => props.onChangeColorB(Palettes.Indexed.indexOf(c.hex))}
        />
      </Child>
    </Split>
  </Row>
)

interface ILaunchpadButtonPulsingColorComponent {
  color: LaunchpadPulsingButtonColor
  onChangeColor: (color: number) => void
  showContextMenu: (x: number, y: number, component: JSX.Element, width?: number, height?: number) => void
}

export const LaunchpadButtonPulsingColorComponent: React.SFC<ILaunchpadButtonPulsingColorComponent> = (props) => (
  <Row title="Color:">
    <Split direction="row">
      <Child basis="50%" padding="0 0.5rem 0 0">
        <IndexPillPicker
          showContextMenu={props.showContextMenu}
          color={Palettes.Indexed[props.color.color] ?? '#000000'}
          onChange={c => props.onChangeColor(Palettes.Indexed.indexOf(c.hex))}
        />
      </Child>
    </Split>
  </Row>
)

interface ILaunchpadButtonRGBColorComponent {
  color: LaunchpadRGBButtonColor
  onChangeColor: (color: string) => void
  showContextMenu: (x: number, y: number, component: JSX.Element, width?: number, height?: number) => void
}

export const LaunchpadButtonRGBColorComponent: React.SFC<ILaunchpadButtonRGBColorComponent> = (props) => (
  <Row title="Color:">
    <Split direction="row">
      <Child basis="40%">
        <FullPillPicker
          showContextMenu={props.showContextMenu}
          color={props.color.color}
          onChange={c => props.onChangeColor(c.hex)}
        />
      </Child>
      <Child basis="60%" align="center" margin="-3px 0 0 0">
        <StyledCircle
          color={props.color.color}
          onChange={c => props.onChangeColor(c.hex)}
          width="100%"
          circleSize={16}
          colors={Palettes.RGBCirclesSmall}
        />
      </Child>
    </Split>
  </Row>
)

interface ILaunchpadButtonLegacyColorComponent {
  color: LaunchpadRGBButtonColor
  onChangeColor: (color: string) => void
  showContextMenu: (x: number, y: number, component: JSX.Element, width?: number, height?: number) => void
}

export const LaunchpadButtonLegacyColorComponent: React.SFC<ILaunchpadButtonLegacyColorComponent> = (props) => (
  <Row title="Color:">
    <Split direction="row">
      <Child grow padding="0 0 0.5rem 0">
        <StyledCircle
          color={props.color.color}
          onChange={c => props.onChangeColor(c.hex)}
          width="100%"
          circleSize={14}
          colors={Palettes.Legacy}
        />
      </Child>
    </Split>
  </Row>
)