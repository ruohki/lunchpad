import * as React from 'react';
import lodash from 'lodash';

import { LaunchpadButton as Button } from '@lunchpad/base'

import { PadContainer, ButtonLook } from '../components';
import { IPadProps } from '..';
import { ControllerType } from '@lunchpad/types';
import { MakeButtonColor } from '../helper';
import { LaunchpadButton } from '../../contexts/layout/classes';

export const XYToButton = (x, y) => y * 6 + x

export const ButtonToXY = (note) => {
  const y = Math.floor(note / 6)
  const x = note % 6
  return [x,y]
}

const Component: React.SFC<IPadProps> = (props) => (
  <PadContainer width={6} height={6}>
    {lodash.reverse(lodash.range(0, 6)).map((y) => lodash.range(0,6).map((x) => {
      const isButton = lodash.get(props.activePage, `buttons.${x}.${y}`, false);
      const button: LaunchpadButton  = lodash.get(props.activePage, `buttons.${x}.${y}`, new LaunchpadButton()) // as Button;
      const color = MakeButtonColor(button.color)
      const { buttonProps } = props;

      return XYToButton(x,y) !== 35 ? (
        <Button
          x={x}
          y={y}
          color={color}
          note={{ note: XYToButton(x,y) }}
          key={`${x}${y}`}
          {...buttonProps}
          canDrag={isButton}
        >
          <ButtonLook look={button.look} />
        </Button>
      ) : (
        <Button
          x={8}
          y={8}
          key="settings"
          note={{ note: 42 }}
          color={"#6a45ff"}
          round
          onContextMenu={() => true}
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


export const Software6x6 = {
  name: "Small 6x6",
  type: ControllerType.Software,
  XYToButton,
  ButtonToXY,
  Component,
  initialize: lodash.noop,
  unload: lodash.noop,
  limitedColor: false
}