import React, { useEffect } from 'react';

import {
  COLOR_BLACK,
  Outer,
  Split,
  Child,
  Button,
  Input,
  COLOR_REDISH,
  ScrollBox,
  IconButton,
  Tooltip,
  PillList,
  PlaySoundPill
} from '@lunchpad/base';
import { Button as ControllerButton, Color, Action, ActionType, PlaySound } from '@lunchpad/types';
import { IconPlus } from '@lunchpad/icons';
import { MenuContext } from '@lunchpad/contexts';

import LaunchpadColorPicker from '../Colorpicker';
import AddActionMenu from '../ContextMenu/addAction';
import { Tab, Divider, Row } from '../Settings/components';
import { Border } from './components';

interface IButtonConfigDialog {
  button: ControllerButton;
  onCancel: () => void
  onAccept: (button: ControllerButton) => void;
}

const ButtonConfigDialog: React.SFC<IButtonConfigDialog> = (props) => {
  const { button, onCancel, onAccept } = props;

  const { showContextMenu, closeMenu } = React.useContext(MenuContext.Context);
  
  const [ title, setTitle ] = React.useState<string>(props.button.title ?? '');
  
  const [ color, setColor ] = React.useState<Color>({ r: button.color.r * 4, g: button.color.g * 4, b: button.color.b * 4 });
  const [ pillComponents, setPills ] = React.useState<JSX.Element[]>([])

  const [ actions, setActions ] = React.useState<Action[]>(button.pressed);

  const accept = () => {
    const btn = new ControllerButton(title, button.x, button.y, {r: color.r / 4, g: color.g / 4, b: color.b / 4})
    btn.pressed = actions;
    onAccept(btn);
  }

  const addAction = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>)  => {
    showContextMenu(e.clientX, e.clientY, (
      <AddActionMenu 
        onSelect={key => console.log(key)}
        onClose={closeMenu}
      />
    ))
  }

  useEffect(() => {
    const removeAction = (id: string) => {
      setActions(actions.filter(a => a.id !== id))
    }

    const updateAction = (action: Action) => {
      setActions(actions.map(a => a.id === action.id ? action : a));
    }

    const pills = actions.map(action => {

      if (action.type == ActionType.PlaySound) {
        return (
          <PlaySoundPill
            key={action.id}
            action={action as PlaySound}
            onChange={(action) => updateAction(action)}
            onRemove={removeAction}
            onMoveUp={() => {}}
            onMoveDown={() => {}}
          />
        );
      } else if (action.type === ActionType.StopAllSounds) {
        
      } else if (action.type === ActionType.PressAHotkey ) {
        
      } else if (action.type === ActionType.PerformWebrequest ) {
        
      } else if (action.type === ActionType.LaunchApplication ) {
        
      }
      return <React.Fragment key={"empty"} />
    })

    setPills(pills);
  }, [ actions ]);

  return (
    <Outer height="100%">
      <Split height="100%">
        <Child>
          <Split direction="row" width="100%" backgroundColor={COLOR_BLACK}>
            <Child>
              <Tab active title="Settings" />
            </Child>
          </Split>
        </Child>
        <Child grow height="100%" padding="1rem 0.5rem 0 1rem">
          <ScrollBox padding="0 0 0 0">
            <Split direction="column" width="100%">
              <Row title="Title">
                <Input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                />
              </Row>
              <Row title="Color">
                <Border padding="0.75rem">
                  <LaunchpadColorPicker
                    color={color}
                    onChange={rgb => setColor(rgb)}
                  />
                </Border>
              </Row>
              <Child padding="0 1rem 0 0">
                <PillList header={(
                  <Split direction={"row"}>
                    <Child grow>
                      {pillComponents.length ? `${pillComponents.length} Action(s):` : 'No actions yet'}
                    </Child>
                    <Child padding="1rem">
                      <Tooltip
                        title="Add a new action to the end of the list of actions."
                      >
                        <IconButton icon={<IconPlus />} onClick={addAction} />
                      </Tooltip>
                    </Child>
                  </Split>
                )}>
                  {pillComponents}
                </PillList>
              </Child>
            </Split>
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

export default ButtonConfigDialog;
