import * as React from 'react';

import {
  LaunchpadButtonLook,
  LaunchpadButtonColor,
  LaunchpadButtonLookType,
  LaunchpadButtonLookImage,
  LaunchpadButtonLookText,
  LaunchpadButtonColorMode,
  LaunchpadSolidButtonColor,
  LaunchpadFlashingButtonColor,
  LaunchpadPulsingButtonColor,
  LaunchpadRGBButtonColor,
  Action
} from '@lunchpad/types';

import { Split, Select, Child, IconButton, Switch } from '@lunchpad/base';

import { LaunchpadButtonLookTextComponent, LaunchpadButtonLookImageComponent, LaunchpadButtonSolidColorComponent, LaunchpadButtonFlashingColorComponent, LaunchpadButtonPulsingColorComponent, LaunchpadButtonRGBColorComponent } from './partials';
import { Divider, Row } from '../Settings/components';
import { ActionEditor } from '../ActionEditor';
import { ButtonDown, Icon, ButtonUp } from '@lunchpad/icons';

interface IActions {
  down: Action[]
  up: Action[]
  loop: boolean

  onChangeLoop(loop: boolean): void
  onChangeDown(actions: Action[]): void
  onChangeUp(actions: Action[]): void
}

export const Actions: React.SFC<IActions> = (props) => {
  
  const [ activeTab, setTab ] = React.useState<number>(0);
  const header = (
    <>
      <IconButton active={activeTab === 0 ? 1 : 0} icon={<Icon icon={ButtonDown} />} onClick={() => setTab(0)}>Pressed ({props.down.length} action(s))</IconButton>
      <span style={{ marginLeft: '1rem', marginRight: '1rem', color: "hsla(0,0%,5%,1)"}}> </span>
      <IconButton active={activeTab === 1 ? 1 : 0} icon={<Icon icon={ButtonUp} />} onClick={() => setTab(1)}>Released ({props.up.length} action(s))</IconButton>
    </>
  )

  return (
    <Split direction="column" width="100%">
      <Row title="Looping">
        <Split direction="row">
          <Child padding="0 1rem 0 0">
            <Switch
              value={props.loop}
              onChange={props.onChangeLoop}
            />
          </Child>
          <Child grow>
            <span>Loop the pressed actions</span>
          </Child>
        </Split>
      </Row>
      <Child padding="1rem 0.5rem 0 0">
        <Divider />
      </Child>
      <Child padding="0 1rem 0 0">
        {activeTab === 0 && <ActionEditor
          header={header}
          actions={props.down}
          onChange={props.onChangeDown}
        />}
        {activeTab === 1 && <ActionEditor
          header={header}
          actions={props.up}
          onChange={props.onChangeUp}
        />}
      </Child>
    </Split>
  )
}