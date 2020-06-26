import * as React from 'react';

import {
  COLOR_BLACK,
  Outer,
  Split,
  Child,
  Button,
  COLOR_REDISH,
  ScrollBox,
  Tab, 
  Divider
} from '@lunchpad/base';

import {
  LaunchpadButton,
  /* Button as ControllerButton, */
  Action,
  LaunchpadButtonLook,
  LaunchpadButtonColor,
  ActionType,
  StopThisMacro,
} from '@lunchpad/types';

import { Appearance } from './appearance';
import { Actions } from './actions';
import { ImportExport } from './importexport';
import { usePrevious, useFirstMountState } from 'react-use';

interface IButtonConfigDialog {
  button: LaunchpadButton
  onCancel: () => void
  onAccept: (button: LaunchpadButton) => void
  limitedColor?: boolean
}

const ButtonConfigDialog: React.SFC<IButtonConfigDialog> = props => {
  const { button, onCancel, onAccept, limitedColor } = props;

  // Visual
  const [ activeTab, setTab ] = React.useState<number>(0);
  
  // Button look
  const [ loop, setLoop ] = React.useState<boolean>(props.button.loop);
  
  const [ look, setLook ] = React.useState<LaunchpadButtonLook>(props.button.look);
  const [ baseColor, setBaseColor ] = React.useState<LaunchpadButtonColor>(button.color);
  const [ activeColor, setActiveColor ] = React.useState<LaunchpadButtonColor | undefined>(button.activeColor);

  // Actions
  const [ down, setDown ] = React.useState<Action[]>(button.down);
  const [ up, setUp ] = React.useState<Action[]>(button.up);

  const prevLoop = usePrevious(loop)
  const firstRender = useFirstMountState()
  const accept = () => {
    const button = new LaunchpadButton();
    button.look = look;
    button.loop = loop;
    button.down = down;
    button.up = up;
    button.color = baseColor;
    button.activeColor = activeColor;

    onAccept(button);
  };
  
  React.useEffect(() => {
    const idx = up.findIndex(a => a.type === ActionType.StopThisMacro || a.type === ActionType.StopAllMacros);
    if (idx === -1 && loop && !prevLoop && !firstRender) {
      setUp([...up, new StopThisMacro()]);
    }
  }, [ loop ])

  return (
    <Outer height="100%">
      <Split height="100%">
        <Child>
          <Split direction="row" width="100%" backgroundColor={COLOR_BLACK}>
            <Child>
              <Tab active={activeTab === 0} title="Appearance" onClick={() => setTab(0)} />
            </Child>
            <Child>
              <Tab active={activeTab === 1} title="Actions" onClick={() => setTab(1)} />
            </Child>
{/*             <Child>
              <Tab active={activeTab === 2} title="Import / Export" onClick={() => setTab(2)} />
            </Child>
            <Child>
              <Tab active={activeTab === 3} title="Log" onClick={() => setTab(3)} />
            </Child> */}
          </Split>
        </Child>
        <Child grow height="100%" padding="1rem 0.5rem 0 1rem">
          <ScrollBox padding="0 0 0 0">
            {activeTab === 0 && (
              <Appearance
                /* TODO: Limited Color */
                limitedColor={limitedColor}
                look={look}
                baseColor={baseColor}
                activeColor={activeColor}
                onChangeLook={setLook}
                onChangeBaseColor={setBaseColor}
                onChangeActiveColor={setActiveColor}
              />
            )}
            {activeTab === 1 && (
              <Actions
                loop={loop}
                onChangeLoop={setLoop}
                down={down}
                onChangeDown={setDown}
                up={up}
                onChangeUp={setUp}
              />
            )}
            {/* activeTab === 2 && (
              <ImportExport
                button={props.button}
                onChangeButton={console.log}
              />
            ) */}
            {/* TODO: Add Logging for button actions */}
          </ScrollBox>
        </Child>
        <Child padding="1rem">
          <Divider />
        </Child>
        <Child>
          <Split direction="row" justify="flex-end">
            <Child margin="0 0 1rem 1rem" basis="0">
              <Button
                padding="4px 25px 8px 25px"
                color={COLOR_REDISH}
                onClick={onCancel}
              >
                Cancel
              </Button>
            </Child>
            <Child margin="0 1rem 1rem 1rem" basis="0">
              <Button padding="4px 25px 8px 25px" onClick={accept}>
                Accept
              </Button>
            </Child>
          </Split>
        </Child>
      </Split>
    </Outer>
  );
};

ButtonConfigDialog.defaultProps = {
  limitedColor: false
}

export default ButtonConfigDialog;
