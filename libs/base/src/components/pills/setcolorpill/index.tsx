import * as React from 'react';
import lodash from 'lodash';

import { SetColor, LaunchpadButtonColorMode, LaunchpadSolidButtonColor, LaunchpadPulsingButtonColor, LaunchpadRGBButtonColor, LaunchpadFlashingButtonColor, LaunchpadButtonColor } from '@lunchpad/types';
import { Icon, Light } from '@lunchpad/icons';

import { Pill } from '../pill'
import { Split, Child, Row } from '../../basic/layout';
import { Select } from '../../basic';

import { LaunchpadButtonSolidColorComponent, LaunchpadButtonFlashingColorComponent, LaunchpadButtonPulsingColorComponent, LaunchpadButtonRGBColorComponent, LaunchpadButtonLegacyColorComponent, PillColorPreview } from './partials';

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
    props.onChange(Object.assign({}, lodash.set(props.action, 'color', color)));
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
    props.onChange(Object.assign({}, lodash.set(props.action, 'color', new LaunchpadRGBButtonColor(rgb))));
  }
  
  const setColorSolid = (index: number) => {
    props.onChange(Object.assign({}, lodash.set(props.action, 'color', new LaunchpadSolidButtonColor(index))));
  }
  
  const setColorFlashingA = (index: number) => {
    props.onChange(Object.assign({}, lodash.set(props.action, 'color', new LaunchpadFlashingButtonColor(index, (props.action.color as LaunchpadFlashingButtonColor).alt))));
  }
  
  const setColorFlashingB = (index: number) => {
    props.onChange(Object.assign({}, lodash.set(props.action, 'color', new LaunchpadFlashingButtonColor((props.action.color as LaunchpadFlashingButtonColor).color, index))));
  }
  
  const setColorPulsing = (index: number) => {
    props.onChange(Object.assign({}, lodash.set(props.action, 'color', new LaunchpadPulsingButtonColor(index))));
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