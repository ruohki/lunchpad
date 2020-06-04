import * as React from 'react';

import { HotkeyKeystrokeSimple, HotkeyKeystrokeType, HotkeyKeystroke } from '@lunchpad/types';


import { Split, Child } from '../../basic/layout';
import { Select } from '../../basic';
import { Modifiers } from './modifiers';

import { KeyboardKeys } from './keys';

export interface IHotkeyKeystrokeSimple {
  keystroke: HotkeyKeystrokeSimple
  onChange: (keystroke: HotkeyKeystrokeSimple) => void
}

export const HotkeyKeystrokeSimpleElement: React.SFC<IHotkeyKeystrokeSimple> = ({ keystroke, onChange }) => {
  const changeKey = (key: string) => {
    onChange(new HotkeyKeystrokeSimple(key, keystroke.modifier, keystroke.event, keystroke.id));
  }

  const changeModifiers = (modifiers: string[]) => {
    onChange(new HotkeyKeystrokeSimple(keystroke.key, modifiers, keystroke.event, keystroke.id));
  }

  return (
    <Split direction="row">
      <Child grow padding="0 1rem 0 0">
        <Select value={keystroke.key} onChange={(e) => changeKey(e.target.value)}>
          {KeyboardKeys.map(k => <option key={k} value={k}>{k}</option>)}
        </Select>
      </Child>
      <Child grow>
        <Modifiers keystroke={keystroke} onChange={changeModifiers} />
      </Child>
    </Split>
  )
}