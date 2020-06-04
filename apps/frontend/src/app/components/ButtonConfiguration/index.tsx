import React, { useEffect } from 'react';
import * as lodash from 'lodash';
import { motion, AnimatePresence } from 'framer-motion';

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
  PlaySoundPill,
  DelayPill,
  SwitchPagePill,
  StopAllMacrosPill,
  TextToSpeechPill,
  LaunchAppPill,
  HotkeyPill
} from '@lunchpad/base';

import {
  Button as ControllerButton,
  Color,
  Action,
  ActionType,
  PlaySound,
  Delay,
  SwitchPage,
  StopAllMacros,
  TextToSpeech,
  LaunchApp,
  Hotkey,
  HotkeyKeystrokeDelay,
  HotkeyKeystrokeString,
  HotkeyKeystrokeSimple,
  HotkeyKeystrokeEvent
} from '@lunchpad/types';
import { IconPlus } from '@lunchpad/icons';
import { MenuContext, AudioContext, LayoutContext } from '@lunchpad/contexts';

import AddActionMenu from '../ContextMenu/addAction';
import { Tab, Divider, Row } from '../Settings/components';
import { Border } from './components';
import { StyledCircle } from '../Colorpicker/components';
import { Small, Limited } from '../Colorpicker/palettes';
import { FullPillPicker } from '../Colorpicker/full';

interface IButtonConfigDialog {
  button: ControllerButton
  onCancel: () => void
  onAccept: (button: ControllerButton) => void
  limitedColor?: boolean
}

const ButtonConfigDialog: React.SFC<IButtonConfigDialog> = props => {
  const { button, onCancel, onAccept, limitedColor } = props;
  const { outputDevices } = React.useContext(AudioContext.Context);
  const { showContextMenu, closeMenu } = React.useContext(MenuContext.Context);

  const [title, setTitle] = React.useState<string>(props.button.title ?? '');

  const [color, setColor] = React.useState<Color>({
    r: button.color.r,
    g: button.color.g,
    b: button.color.b
  });

  const [ actions, setActions ] = React.useState<Action[]>(button.pressed);
  const { pages } = React.useContext(LayoutContext.Context);

console.log("Actions.", actions.length)

  const accept = () => {
    const btn = new ControllerButton(title, button.x, button.y, {
      r: color.r,
      g: color.g,
      b: color.b
    });
    btn.pressed = actions;
    console.log(actions)
    onAccept(btn);
  };

  console.log(actions)

  const addAction = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    showContextMenu(
      e.clientX,
      e.clientY,
      <AddActionMenu
        onSelect={key => {
          console.log(key);
          if (key === ActionType.PlaySound) {
            setActions([...actions, new PlaySound('')]);
          } else if (key === ActionType.Delay) {
            setActions([...actions, new Delay(1000)]);
          } else if (key === ActionType.SwitchPage) {
            setActions([...actions, new SwitchPage('default')]);
          } else if (key === ActionType.StopAllMacros) {
            setActions([...actions, new StopAllMacros()]);
          } else if (key === ActionType.TextToSpeech) {
            setActions([...actions, new TextToSpeech('1, 2, 3!')]);
          } else if (key === ActionType.LaunchApplication) {
            setActions([...actions, new LaunchApp()]);
          } else if (key === ActionType.PressAHotkey) {
            setActions([...actions, new Hotkey() ]);
          }
        }}
        onClose={closeMenu}
      />
    );
  };

  const moveActionUp = (id: string) => {
    const idx = lodash.findIndex(actions, a => a.id === id);
    const temp = actions[idx];
    actions[idx] = actions[idx - 1];
    actions[idx - 1] = temp;
    setActions([...actions]);
  };

  const moveActionDown = (id: string) => {
    const idx = lodash.findIndex(actions, a => a.id === id);
    const temp = actions[idx];
    actions[idx] = actions[idx + 1];
    actions[idx + 1] = temp;
    setActions([...actions]);
  };

  const removeAction = (id: string) => {
    setActions([...actions.filter(a => a.id !== id)]);
  };

  
  //useEffect(() => {
    const updateAction = (action: Action) => {
      console.log(actions, action)
      setActions([...actions.map(a => (a.id === action.id ? action : a))]);
    };

    const pills = actions.map((action, i) => {
      const pillDefaults = {
        onChange: action => updateAction(action),
        onRemove: removeAction,
        onMoveUp: i !== 0 ? () => moveActionUp(action.id) : null,
        onMoveDown:
          i < actions.length - 1 ? () => moveActionDown(action.id) : null
      };

      if (action.type === ActionType.Delay)
        return (
          <DelayPill
            key={action.id}
            action={action as Delay}
            {...pillDefaults}
          />
        );
      else if (action.type == ActionType.PlaySound)
        return (
          <PlaySoundPill
            key={action.id}
            outputDevices={outputDevices}
            action={action as PlaySound}
            {...pillDefaults}
          />
        );
      else if (action.type === ActionType.SwitchPage)
        return (
          <SwitchPagePill
            key={action.id}
            pages={pages.map(p => ({ id: p.id, name: p.name }))}
            action={action as SwitchPage}
            {...pillDefaults}
          />
        );
      else if (action.type === ActionType.StopAllMacros)
        return (
          <StopAllMacrosPill
            key={action.id}
            action={action as StopAllMacros}
            {...pillDefaults}
          />
        );
      else if (action.type === ActionType.TextToSpeech)
        return (
          <TextToSpeechPill
            key={action.id}
            action={action as TextToSpeech}
            {...pillDefaults}
          />
        );
      else if (action.type === ActionType.PressAHotkey)
        return (
          <HotkeyPill
            key={action.id}
            action={action as Hotkey}
            showMenu={showContextMenu}
            closeMenu={closeMenu}
            {...pillDefaults}
          />
        );
      else if (action.type === ActionType.LaunchApplication)
        return (
          <LaunchAppPill
            key={action.id}
            action={action as LaunchApp}
            {...pillDefaults}
          />
        );
      else return <React.Fragment key={'empty'} />;
    });

    //setPills(pills);
  //}, [ actions, setActions ]);

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
                <Input value={title} onChange={e => setTitle(e.target.value)} />
              </Row>
              <Row title="Color">
                <Border>
                  <Split direction="row">
                    {limitedColor ? (
                      <Child grow padding="0 0 0.5rem 0">
                      <StyledCircle
                        color={color}
                        onChange={c => setColor(c.rgb)}
                        width="100%"
                        circleSize={14}
                        colors={Limited}
                      />
                    </Child>
                    ) : (
                      <>
                        <Child basis="40%">
                          <FullPillPicker
                            color={color}
                            onChange={c => setColor(c.rgb)}
                          />
                        </Child>
                        <Child basis="60%" align="center" margin="-3px 0 0 0">
                          <StyledCircle
                            color={color}
                            onChange={c => setColor(c.rgb)}
                            width="100%"
                            circleSize={16}
                            colors={Small}
                          />
                        </Child>
                      </>
                    )}
                  </Split>
                </Border>
              </Row>
              <Child padding="0 1rem 0 0">
                <PillList
                  header={
                    <Split direction={'row'}>
                      <Child grow>
                        {pills.length
                          ? `${pills.length} Action(s):`
                          : 'No actions yet'}
                      </Child>
                      <Child padding="1rem">
                        <Tooltip title="Add a new action to the end of the list of actions.">
                          <IconButton icon={<IconPlus />} onClick={addAction} />
                        </Tooltip>
                      </Child>
                    </Split>
                  }
                >
                  <AnimatePresence>
                    {pills.map(p => (
                      <motion.div
                        positionTransition={{
                          type: 'spring',
                          damping: 30,
                          stiffness: 200
                        }}
                        initial={{ opacity: 0, translateX: -100 }}
                        animate={{ opacity: 1, translateX: 0 }}
                        exit={{ opacity: 0, translateX: 100 }}
                        key={p.props.action.id}
                      >
                        {p}
                      </motion.div>
                    ))}
                  </AnimatePresence>
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

ButtonConfigDialog.defaultProps = {
  limitedColor: false
}

export default ButtonConfigDialog;
