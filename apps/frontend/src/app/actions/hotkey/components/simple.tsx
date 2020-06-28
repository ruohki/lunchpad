import * as React from 'react';

import { Split, Child, Select } from '@lunchpad/base';

import { Modifiers } from './modifiers';

import { KeyboardKeys } from '../keys';
import { HotkeyKeystrokeSimple } from '../classes';

export interface IHotkeyKeystrokeSimple {
  keystroke: HotkeyKeystrokeSimple
  onChange: (keystroke: HotkeyKeystrokeSimple) => void
}

export const HotkeyKeystrokeSimpleElement: React.SFC<IHotkeyKeystrokeSimple> = (props) => {
  const changeKey = (key: string) => {
    props.onChange(new HotkeyKeystrokeSimple(key, props.keystroke.modifier, props.keystroke.event, props.keystroke.id));
  }

  const changeModifiers = (modifiers: string[]) => {
    props.onChange(new HotkeyKeystrokeSimple(props.keystroke.key, modifiers, props.keystroke.event, props.keystroke.id));
  }

  return (
    <Split direction="row">
      <Child grow padding="0 1rem 0 0">
        <Select value={props.keystroke.key} onChange={(e) => changeKey(e.target.value)}>
          {KeyboardKeys.map(k => <option key={k} value={k}>{k}</option>)}
        </Select>
      </Child>
      <Child grow>
        <Modifiers modifiers={props.keystroke.modifier} onChange={changeModifiers} />
      </Child>
    </Split>
  )
}