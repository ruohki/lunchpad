import * as React from 'react';

import { HotkeyKeystrokeString } from '@lunchpad/types';

import { Split, Child } from '../../basic/layout';

import { Input, Tooltip } from '../../basic';

export interface IHotkeyKeystrokeString {
  keystroke: HotkeyKeystrokeString
  onChange: (keystroke: HotkeyKeystrokeString) => void
}

export const HotkeyKeystrokeStringElement: React.SFC<IHotkeyKeystrokeString> = ({ keystroke, onChange }) => {
  const changeString = (text: string) => {
    onChange(new HotkeyKeystrokeString(text, keystroke.delay, keystroke.id));
  }

  const changeDelay = (delay: number) => {
    onChange(new HotkeyKeystrokeString(keystroke.text, delay, keystroke.id))
  }

  return (
    <Split direction="row">
      <Child grow padding="0 1rem 0 0">
        <Input value={keystroke.text} onChange={(e) => changeString(e.target.value)} />
      </Child>
      <Child basis="15%" padding="0 1rem 0 0">
        <Tooltip
          title="Delay between each keystroke"
        >
          <Input value={keystroke.delay} onChange={(e) => changeDelay(Math.round(parseInt(e.target.value)) || 0)} />
        </Tooltip>
      </Child>
      <Child>
        <span>ms</span>
      </Child>
    </Split>
  )
}