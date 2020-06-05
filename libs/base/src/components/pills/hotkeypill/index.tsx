import * as React from 'react';
import * as lodash from 'lodash';

import { Hotkey, HotkeyKeystrokeType, HotkeyKeystroke, HotkeyKeystrokeSimple, HotkeyKeystrokeDelay, HotkeyKeystrokeEvent, HotkeyKeystrokeString } from '@lunchpad/types';
import {
  IconEdit,
  IconTimes,
  IconCheck,
  IconTrash,
  IconUp,
  IconDown,
  IconKeyboard,
  IconPlus,
  IconStopwatch,
  IconSortAlt,
  IconLongArrowAltDown,
  IconLongArrowAltUp
} from '@lunchpad/icons';

import { PillHeader, PillBorder } from '../pill';
import { Split, Child, VerticalPipe, Row } from '../../basic/layout';
import { IconButton, Tooltip, Switch } from '../../basic';
import List, { ListItem } from '../../basic/list';
import { COLOR_REDISH, COLOR_BLURPLE } from '../../../theme';

import { useMouseHovered } from 'react-use';

import { ChangeTypeMenu } from './changeTypeMenu';
import { AddKeystrokeMenu } from './addKeystrokeMenu'

import { HotkeyKeystrokeSimpleElement } from './simple'
import { HotkeyKeystrokeDelayElement } from './delay'
import { HotkeyKeystrokeStringElement } from './string'
import { motion, AnimatePresence } from 'framer-motion';

interface IHotkeyPill {
  action: Hotkey;
  expanded?: boolean;
  showMenu?: (x: number, y: number, component: JSX.Element) => void;
  closeMenu?: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  onChange?: (action: Hotkey) => void;
  onRemove?: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
}

interface IHotkeyKeystrokePill {
  keystroke: HotkeyKeystroke
  showMenu?: (x: number, y: number, component: JSX.Element) => void;
  closeMenu?: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  onChange?: (keystroke: HotkeyKeystroke) => void;
  onRemove?: (id: string) => void
  onMoveUp?: (id: string) => void
  onMoveDown?: (id: string) => void
}


const TypeIcons = {
  [HotkeyKeystrokeType.SimpleDown]: <IconLongArrowAltDown />,
  [HotkeyKeystrokeType.SimpleUp]: <IconLongArrowAltUp />,
  [HotkeyKeystrokeType.SimpleDownUp]: <IconSortAlt />,
  [HotkeyKeystrokeType.Delay]: <IconStopwatch />,
  [HotkeyKeystrokeType.String]: <IconKeyboard />,
}

const HotkeyKeystrokePill: React.SFC<IHotkeyKeystrokePill> = ({ keystroke, showMenu, closeMenu, onMoveUp, onMoveDown, onRemove, onChange }) => {

  const ref = React.useRef(null);
  const mouse = useMouseHovered(ref, { whenHovered: true })
  
  const changeType = () => {
    showMenu(mouse.posX, mouse.posY, (
      <ChangeTypeMenu
        onClose={closeMenu}
        onSelect={(id) => {
          const s = keystroke as HotkeyKeystrokeSimple
          onChange(new HotkeyKeystrokeSimple(s.key, s.modifier, id as HotkeyKeystrokeEvent, s.id))
          //setStroke(new HotkeyKeystrokeSimple(s.key, s.modifier, id as HotkeyKeystrokeEvent, s.id))
        }}
      />
    ))
  }

 
  const change = (stroke: HotkeyKeystroke) => {
    onChange(stroke);
  }

  return (
    <ListItem>
      <Split direction="row">
        <Child padding={"0 1rem 0 0"}>
          {((keystroke.type === HotkeyKeystrokeType.SimpleDown) ||
            (keystroke.type === HotkeyKeystrokeType.SimpleUp) ||
            (keystroke.type === HotkeyKeystrokeType.SimpleDownUp)) ? ( 
            <Tooltip
              title="Change the type of this keyboard event"
            >
              <div ref={ref}>
                <IconButton
                  icon={TypeIcons[keystroke.type]}
                  onClick={() => changeType()}
                />
              </div>
            </Tooltip>
            ) : TypeIcons[keystroke.type]
          }
        </Child>
        {((keystroke.type === HotkeyKeystrokeType.SimpleDown) || 
          (keystroke.type === HotkeyKeystrokeType.SimpleUp) ||
          (keystroke.type === HotkeyKeystrokeType.SimpleDownUp)) && (
          <Child grow padding="0 1rem 0 0">
            <HotkeyKeystrokeSimpleElement
              keystroke={keystroke as HotkeyKeystrokeSimple}
              onChange={change}
            />
          </Child>
        )}
        {keystroke.type === HotkeyKeystrokeType.Delay && (
          <Child grow padding="0 1rem 0 0">
            <HotkeyKeystrokeDelayElement
              keystroke={keystroke as HotkeyKeystrokeDelay}
              onChange={change}
            />
          </Child>
        )}
        {keystroke.type === HotkeyKeystrokeType.String && (
          <Child grow padding="0 1rem 0 0">
            <HotkeyKeystrokeStringElement
              keystroke={keystroke as HotkeyKeystrokeString}
              onChange={change}
            />
          </Child>
        )}

        <Child padding="0">
          <IconButton
            disabled={!onMoveUp}
            icon={<IconUp />}
            onClick={() => onMoveUp(keystroke.id)}
          />
        </Child>
        <Child padding="0 0 0 1rem">
          <IconButton
            disabled={!onMoveDown}
            icon={<IconDown />}
            onClick={() => onMoveDown(keystroke.id)}
          />
        </Child>
        <Child padding="0 1rem 0 1rem">
          <VerticalPipe />
        </Child>
        <Child padding="0"></Child>
        <Child padding="0">
          <Tooltip title="Removes the keyboard event from the list! ITS GONE!" >
            <IconButton hover={COLOR_REDISH} onClick={() => onRemove(keystroke.id)} icon={<IconTrash />} />
          </Tooltip>
        </Child>
      </Split>
    </ListItem>
)
}

const KeystrokeHeaderMenu = ({ showMenu, closeMenu, keystrokes, onAdd }) => {
  const ref = React.useRef(null);
  const mouse = useMouseHovered(ref, { whenHovered: true })

  const onAddClick = () => {
    showMenu(mouse.posX, mouse.posY, (
      <AddKeystrokeMenu 
        onClose={closeMenu}
        onSelect={onAdd}
      />
    ))
  }

  return (
    <Split direction={'row'}>
      <Child grow>
        {keystrokes > 0 ? keystrokes : 'No'} Keyboarde events
      </Child>
      <Child padding="1rem">
        <div ref={ref}>
          <Tooltip title="Add a keyboard event to the list.">
            <IconButton icon={<IconPlus />} onClick={() => onAddClick()} />
          </Tooltip>
        </div>
      </Child>
    </Split>
  )

}

export const HotkeyPill: React.SFC<IHotkeyPill> = ({
  action,
  expanded,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  showMenu,
  closeMenu,
}) => {
  const [showBody, setExpanded] = React.useState<boolean>(expanded);

  const [wait, setWait] = React.useState<boolean>(action.wait);
  const [releaseEnd, setReleaseEnd] = React.useState<boolean>(action.restoreAllAtEnd);

  const [ keystrokes, setKeystrokes ] = React.useState<HotkeyKeystroke[]>(action.keystrokes);
  
  const change = () => {
    const actn = new Hotkey(keystrokes, releaseEnd, action.id);
    actn.wait = wait;
    onChange(actn);
    setExpanded(false);
  };

  const moveKeystrokeUp = (id: string) => {
    const idx = lodash.findIndex(keystrokes, a => a.id === id);
    const temp = keystrokes[idx];
    keystrokes[idx] = keystrokes[idx - 1];
    keystrokes[idx - 1] = temp;
    setKeystrokes([...keystrokes]);
  };

  const moveKeystrokeDown = (id: string) => {
    const idx = lodash.findIndex(keystrokes, a => a.id === id);
    const temp = keystrokes[idx];
    keystrokes[idx] = keystrokes[idx + 1];
    keystrokes[idx + 1] = temp;
    setKeystrokes([...keystrokes]);
  };

  const removeKeystroke = (id: string) => setKeystrokes(keystrokes.filter(k => k.id !== id))

  const addKeystroke = (id: string) => {
    const type = id as HotkeyKeystrokeType
    if (type === HotkeyKeystrokeType.Delay) setKeystrokes([...keystrokes, new HotkeyKeystrokeDelay(100) ])
    if (type === HotkeyKeystrokeType.String) setKeystrokes([...keystrokes, new HotkeyKeystrokeString(":)", 10) ])
    if (type === HotkeyKeystrokeType.SimpleDown) setKeystrokes([...keystrokes, new HotkeyKeystrokeSimple("enter", [], HotkeyKeystrokeEvent.KeyDown) ])
    if (type === HotkeyKeystrokeType.SimpleUp) setKeystrokes([...keystrokes, new HotkeyKeystrokeSimple("enter", [], HotkeyKeystrokeEvent.KeyUp) ])
    if (type === HotkeyKeystrokeType.SimpleDownUp) setKeystrokes([...keystrokes, new HotkeyKeystrokeSimple("enter", [], HotkeyKeystrokeEvent.KeyDownUp) ])
  }

  const updateKeystroke = (stroke: HotkeyKeystroke) => {
    setKeystrokes(keystrokes.map(s => (s.id === stroke.id ? stroke : s)));
  }

  return (
    <PillBorder show={showBody}>
      <PillHeader expanded={showBody}>
        <Split direction="row">
          <Child padding={'0 1rem 0 0'}>
            <IconKeyboard />
          </Child>
          {showBody ? (
            <>
              <Child grow width="40%" whiteSpace="nowrap">
                <div style={{ textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  Edit: Hotkey sequence
                </div>
              </Child>
              <Child padding="0">
                <Tooltip title="Removes the action from the list! ITS GONE!">
                  <IconButton
                    hover={COLOR_REDISH}
                    onClick={() => onRemove(action.id)}
                    icon={<IconTrash />}
                  />
                </Tooltip>
              </Child>
              <Child padding="0 0 0 2rem">
                <Tooltip title="Update this action with the current settings">
                  <IconButton
                    hover={COLOR_BLURPLE}
                    onClick={change}
                    icon={<IconCheck />}
                  />
                </Tooltip>
              </Child>
              <Child padding="0 0 0 2rem">
                <Tooltip title="Discard changes made to this action">
                  <IconButton
                    hover={COLOR_REDISH}
                    onClick={() => setExpanded(false)}
                    icon={<IconTimes />}
                  />
                </Tooltip>
              </Child>
            </>
          ) : (
            <>
              <Child grow width="50%" whiteSpace="nowrap">
                <div style={{ textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  Hotkey:
                </div>
              </Child>
              <Child padding="0">
                <IconButton
                  disabled={!onMoveUp}
                  icon={<IconUp />}
                  onClick={() => onMoveUp(action.id)}
                />
              </Child>
              <Child padding="0 0 0 1rem">
                <IconButton
                  disabled={!onMoveDown}
                  icon={<IconDown />}
                  onClick={() => onMoveDown(action.id)}
                />
              </Child>
              <Child padding="0 1rem 0 1rem">
                <VerticalPipe />
              </Child>
              <Child padding="0">
                <IconButton
                  onClick={() => setExpanded(true)}
                  icon={<IconEdit />}
                />
              </Child>
            </>
          )}
        </Split>
      </PillHeader>
      {showBody && (
        <Split direction="column" padding="1rem 1rem 0 1rem">
          <Child>
            <Split>
              <Row title="">
                <Split direction="row">
                  <Child padding="0 1rem 0 0">
                    <Switch value={wait} onChange={setWait} />
                  </Child>
                  <Child grow>
                    <span>Await execution of this action</span>
                  </Child>
                </Split>
              </Row>
              <Row title="">
                <Split direction="row">
                  <Child padding="0 1rem 0 0">
                    <Tooltip
                      title="Releases all keys that might still be in pressed state after this action ends"
                    >
                      <Switch value={releaseEnd} onChange={setReleaseEnd} />
                    </Tooltip>
                  </Child>
                  <Child grow>
                    <span>Restore key states when action ends</span>
                  </Child>
                </Split>
              </Row>
              <Child>
                <List
                  menu={
                    <KeystrokeHeaderMenu
                      closeMenu={closeMenu}
                      showMenu={showMenu}
                      keystrokes={action.keystrokes.length}
                      onAdd={addKeystroke}
                    />
                  }
                >
                  <AnimatePresence>
                    {keystrokes.map((s,i) => (
                      <motion.div
                        positionTransition={{
                          type: 'spring',
                          damping: 30,
                          stiffness: 200
                        }}
                        initial={{ opacity: 0, translateX: -100 }}
                        animate={{ opacity: 1, translateX: 0 }}
                        exit={{ opacity: 0, translateX: 100 }}
                        key={s.id}
                      >
                        <HotkeyKeystrokePill
                          key={s.id}
                          showMenu={showMenu}
                          closeMenu={closeMenu}
                          keystroke={s}
                          onMoveUp={i !== 0 ? () => moveKeystrokeUp(s.id) : null}
                          onMoveDown={i < keystrokes.length - 1 ? () => moveKeystrokeDown(s.id) : null}
                          onRemove={removeKeystroke}
                          onChange={updateKeystroke}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </List>
              </Child>
            </Split>
          </Child>
        </Split>
      )}
    </PillBorder>
  );
};

HotkeyPill.defaultProps = {
  expanded: false,
  onChange: () => {},
  onRemove: () => {}
};
