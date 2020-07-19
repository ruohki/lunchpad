import * as React from 'react';
import styled from 'styled-components';
import lodash from 'lodash';

import { darken } from 'polished';

import { Icon, Light } from '@lunchpad/icons';
import { Split, Child, Row, Select, Palettes, IndexPillPicker, FullPillPicker, StyledCircle } from '@lunchpad/base';

import Pill from '../pill'
import { SetColor } from './classes';
import { LaunchpadButtonColorMode, LaunchpadSolidButtonColor, LaunchpadFlashingButtonColor, LaunchpadPulsingButtonColor, LaunchpadRGBButtonColor, LaunchpadButtonColor } from '../../contexts/layout/classes/colors';

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
  color: LaunchpadSolidButtonColor | LaunchpadFlashingButtonColor | LaunchpadPulsingButtonColor | LaunchpadRGBButtonColor
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


type MoveFN = (id: string) => void

interface ISetColorPill {
  action: SetColor
  showContextMenu: (x: number, y: number, component: JSX.Element, width?: number, height?: number) => void
  limitedColor: boolean
  expanded?: boolean
  onChange?: (action: SetColor) => void
  onRemove?: (id: string) => void
  onMoveUp: MoveFN | undefined
  onMoveDown: MoveFN | undefined
}

export const SetColorPill: React.SFC<ISetColorPill> = (props) => {
  const [ showBody, setExpanded ] = React.useState<boolean>(props.expanded);

  const setColor = (color: LaunchpadButtonColor) => {
    props.onChange(lodash.set(props.action, 'color', color));
  }
  
  const setColorMode = (mode: LaunchpadButtonColorMode) => {
    if (mode === -1) return setColor(undefined);

    if (mode === LaunchpadButtonColorMode.Static) {
      setColor(new LaunchpadSolidButtonColor(LaunchpadSolidButtonColor.RandomIndex()))
    } else if (mode === LaunchpadButtonColorMode.Flashing) {
      setColor(new LaunchpadFlashingButtonColor(LaunchpadFlashingButtonColor.RandomIndex(), LaunchpadFlashingButtonColor.RandomIndex()))
    } else if (mode === LaunchpadButtonColorMode.Pulsing) {
      setColor(new LaunchpadPulsingButtonColor(LaunchpadPulsingButtonColor.RandomIndex()))
    } else if (mode === LaunchpadButtonColorMode.RGB) {
      setColor(new LaunchpadRGBButtonColor(LaunchpadRGBButtonColor.RandomRGB()))
    }
  }

  const setColorRGB = (rgb: string) => {
    props.onChange(lodash.set(props.action, 'color', new LaunchpadRGBButtonColor(rgb)));
  }
  
  const setColorSolid = (index: number) => {
    props.onChange(lodash.set(props.action, 'color', new LaunchpadSolidButtonColor(index)));
  }
  
  const setColorFlashingA = (index: number) => {
    props.onChange(lodash.set(props.action, 'color', new LaunchpadFlashingButtonColor(index, (props.action.color as LaunchpadFlashingButtonColor).alt)));
  }
  
  const setColorFlashingB = (index: number) => {
    props.onChange(lodash.set(props.action, 'color', new LaunchpadFlashingButtonColor((props.action.color as LaunchpadFlashingButtonColor).color, index)));
  }
  
  const setColorPulsing = (index: number) => {
    props.onChange(lodash.set(props.action, 'color', new LaunchpadPulsingButtonColor(index)));
  }


  const Expanded = (
    <Split direction="row">
      <Child grow whiteSpace="nowrap" padding="0 1rem 0 0"><div style={{textOverflow: "ellipsis", overflow: "hidden"}}>Set button color<PillColorPreview color={props.action.color} /></div></Child>
    </Split>
  )
  
  return (
    <Pill
      isExpanded={showBody}
      icon={<Icon icon={Light} />}
      expanded={Expanded}
      collapsed={Expanded}
      onRemove={() => props.onRemove(props.action.id)}
      onMoveUp={props.onMoveUp ? () => props.onMoveUp(props.action.id) : null}
      onMoveDown={props.onMoveDown ? () => props.onMoveDown(props.action.id) : null}
      onExpand={() => setExpanded(true)}
      onCollapse={() => setExpanded(false)}
    >
      <Split padding="0 0 1rem 0">
        {!props.limitedColor && (
          <Row title="Base color:">
            <Select
              value={props.action.color.mode}
              onChange={e => setColorMode(parseInt(e.target.value) as LaunchpadButtonColorMode)}
            >
              <option value={LaunchpadButtonColorMode.Static}>Solid (indexed)</option>
              <option value={LaunchpadButtonColorMode.Flashing}>Flashing (indexed)</option>
              <option value={LaunchpadButtonColorMode.Pulsing}>Pulsing (indexed)</option>
              <option value={LaunchpadButtonColorMode.RGB}>RGB</option>
            </Select>
          </Row>
        )}
        {!props.limitedColor ? (
          <>
            {props.action.color.mode === LaunchpadButtonColorMode.Static && (
              <LaunchpadButtonSolidColorComponent
                color={props.action.color as LaunchpadSolidButtonColor}
                showContextMenu={props.showContextMenu}
                onChangeColor={idx => setColorSolid(idx)}
              />
            )}
            {props.action.color.mode === LaunchpadButtonColorMode.Flashing && (
              <LaunchpadButtonFlashingColorComponent
                color={props.action.color as LaunchpadFlashingButtonColor}
                showContextMenu={props.showContextMenu}
                onChangeColorA={idx => setColorFlashingA(idx)}
                onChangeColorB={idx => setColorFlashingB(idx)}
              />
            )}
            {props.action.color.mode === LaunchpadButtonColorMode.Pulsing && (
              <LaunchpadButtonPulsingColorComponent
                color={props.action.color as LaunchpadPulsingButtonColor}
                showContextMenu={props.showContextMenu}
                onChangeColor={idx => setColorPulsing(idx)}
              />
            )}
            {props.action.color.mode === LaunchpadButtonColorMode.RGB && (
              <LaunchpadButtonRGBColorComponent
                color={props.action.color as LaunchpadRGBButtonColor}
                showContextMenu={props.showContextMenu}
                onChangeColor={color => setColorRGB(color)}
              />
            )}
          </>
        ) : (
          <LaunchpadButtonLegacyColorComponent
            color={props.action.color as LaunchpadRGBButtonColor}
            showContextMenu={props.showContextMenu}
            onChangeColor={color => setColorRGB(color)}
          />
        )}
      </Split>
    </Pill>
  )
}

SetColorPill.defaultProps = {
  expanded: false,
  onChange: () => {},
  onRemove: () => {},
}