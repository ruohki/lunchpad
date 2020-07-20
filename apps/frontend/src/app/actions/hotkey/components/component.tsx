import * as React from 'react';
import lodash from 'lodash';

import {
  Icon,
  Trash,
  ArrowUp,
  ArrowDown,
  Keyboard,
  Plus,
  Stopwatch,
  ButtonDown,
  ButtonUp,
  ButtonDownUp,
} from '@lunchpad/icons';

// TODO: Proper export those from a maybe ui package

import Pill from '../../pill';
import List, { ListItem } from './list';
import { Split, Child, VerticalPipe, Row, IconButton, Tooltip, Switch, COLOR_REDISH } from '@lunchpad/base';

import { useMouseHovered } from 'react-use';

import { ChangeTypeMenu } from './changeTypeMenu';
import { AddKeystrokeMenu } from './addKeystrokeMenu'

import { HotkeyKeystrokeSimpleElement } from './simple'
import { HotkeyKeystrokeDelayElement } from './delay'
import { HotkeyKeystrokeStringElement } from './string'
import { motion, AnimatePresence } from 'framer-motion';
import { Hotkey, HotkeyKeystroke, HotkeyKeystrokeType, HotkeyKeystrokeSimple, HotkeyKeystrokeEvent, HotkeyKeystrokeDelay, HotkeyKeystrokeString } from '../classes';

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
  [HotkeyKeystrokeType.SimpleDown]: <Icon icon={ButtonDown} />,
  [HotkeyKeystrokeType.SimpleUp]: <Icon icon={ButtonUp} />,
  [HotkeyKeystrokeType.SimpleDownUp]: <Icon icon={ButtonDownUp} />,
  [HotkeyKeystrokeType.Delay]: <Icon icon={Stopwatch} />,
  [HotkeyKeystrokeType.String]: <Icon icon={Keyboard} />,
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
            icon={<Icon icon={ArrowUp} />}
            onClick={() => onMoveUp(keystroke.id)}
          />
        </Child>
        <Child padding="0 0 0 1rem">
          <IconButton
            disabled={!onMoveDown}
            icon={<Icon icon={ArrowDown} />}
            onClick={() => onMoveDown(keystroke.id)}
          />
        </Child>
        <Child padding="0 1rem 0 1rem">
          <VerticalPipe />
        </Child>
        <Child padding="0"></Child>
        <Child padding="0">
          <Tooltip title="Removes the keyboard event from the list! ITS GONE!" >
            <IconButton hover={COLOR_REDISH} onClick={() => onRemove(keystroke.id)} icon={<Icon icon={Trash} />} />
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
        {keystrokes > 0 ? keystrokes : 'No'} Keyboard event(s)
      </Child>
      <Child padding="1rem">
        <div ref={ref}>
          <Tooltip title="Add a keyboard event to the list.">
            <IconButton icon={<Icon icon={Plus} />} onClick={() => onAddClick()} />
          </Tooltip>
        </div>
      </Child>
    </Split>
  )
}

export const HotkeyPill: React.SFC<IHotkeyPill> = (props) => {
  const [showBody, setExpanded] = React.useState<boolean>(props.expanded);
  const setProp = (prop) => {
    props.onChange(Object.assign(props.action, prop))
  }

  const moveKeystrokeUp = (id: string) => {
    const idx = lodash.findIndex(props.action.keystrokes, a => a.id === id);
    const temp = props.action.keystrokes[idx];
    props.action.keystrokes[idx] = props.action.keystrokes[idx - 1];
    props.action.keystrokes[idx - 1] = temp;
    setProp({ keystrokes: [...props.action.keystrokes] })
  };

  const moveKeystrokeDown = (id: string) => {
    const idx = lodash.findIndex(props.action.keystrokes, a => a.id === id);
    const temp = props.action.keystrokes[idx];
    props.action.keystrokes[idx] = props.action.keystrokes[idx + 1];
    props.action.keystrokes[idx + 1] = temp;
    setProp({ keystrokes: [...props.action.keystrokes] })
  };

  const removeKeystroke = (id: string) => setProp({ keystrokes: [...props.action.keystrokes.filter(k => k.id !== id)] })

  const addKeystroke = (id: string) => {
    const type = id as HotkeyKeystrokeType
    
    if (type === HotkeyKeystrokeType.Delay) setProp({ keystrokes: [...props.action.keystrokes, new HotkeyKeystrokeDelay(100) ]})
    if (type === HotkeyKeystrokeType.String) setProp({ keystrokes: [...props.action.keystrokes, new HotkeyKeystrokeString(":)", 10) ]})
    if (type === HotkeyKeystrokeType.SimpleDown) setProp({ keystrokes: [...props.action.keystrokes, new HotkeyKeystrokeSimple("enter", [], HotkeyKeystrokeEvent.KeyDown) ]})
    if (type === HotkeyKeystrokeType.SimpleUp) setProp({ keystrokes: [...props.action.keystrokes, new HotkeyKeystrokeSimple("enter", [], HotkeyKeystrokeEvent.KeyUp) ]})
    if (type === HotkeyKeystrokeType.SimpleDownUp) setProp({ keystrokes: [...props.action.keystrokes, new HotkeyKeystrokeSimple("enter", [], HotkeyKeystrokeEvent.KeyDownUp) ]})
  }

  const updateKeystroke = (stroke: HotkeyKeystroke) => {
    setProp({ keystrokes: props.action.keystrokes.map(s => (s.id === stroke.id ? stroke : s))})
  }

  const Expanded = (
    <Split direction="row">
      <Child grow whiteSpace="nowrap" padding="0 1rem 0 0"><div style={{textOverflow: "ellipsis", overflow: "hidden"}}>Hotkey sequence: {props.action.keystrokes.length} Keystroke(s)</div></Child>
    </Split>
  )

  return (
    <Pill
      isExpanded={showBody}
      icon={<Icon icon={Keyboard} />}
      expanded={Expanded}
      collapsed={Expanded}
      onRemove={() => props.onRemove(props.action.id)}
      onMoveUp={props.onMoveUp ? () => props.onMoveUp(props.action.id) : null}
      onMoveDown={props.onMoveDown ? () => props.onMoveDown(props.action.id) : null}
      onExpand={() => setExpanded(true)}
      onCollapse={() => setExpanded(false)}
    >
      <Split>
        <Row title="">
          <Split direction="row">
            <Child padding="0 1rem 0 0">
              <Switch value={props.action.wait} onChange={wait => setProp({ wait })} />
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
                <Switch value={props.action.restoreAllAtEnd} onChange={restoreAllAtEnd => setProp({ restoreAllAtEnd })} />
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
                closeMenu={props.closeMenu}
                showMenu={props.showMenu}
                keystrokes={props.action.keystrokes.length}
                onAdd={addKeystroke}
              />
            }
          >
            <AnimatePresence>
              {props.action.keystrokes.map((s,i) => (
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
                    showMenu={props.showMenu}
                    closeMenu={props.closeMenu}
                    keystroke={s}
                    onMoveUp={i !== 0 ? () => moveKeystrokeUp(s.id) : null}
                    onMoveDown={i < props.action.keystrokes.length - 1 ? () => moveKeystrokeDown(s.id) : null}
                    onRemove={removeKeystroke}
                    onChange={updateKeystroke}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </List>
        </Child>
      </Split>
    </Pill>
  )
};

HotkeyPill.defaultProps = {
  expanded: false,
  onChange: () => {},
  onRemove: () => {}
};
