import * as React from 'react';

import { Split, Child, Input, Tooltip } from '@lunchpad/base';
import { HotkeyKeystrokeString } from '../classes';

export interface IHotkeyKeystrokeString {
  keystroke: HotkeyKeystrokeString
  onChange: (keystroke: HotkeyKeystrokeString) => void
}

export const HotkeyKeystrokeStringElement: React.SFC<IHotkeyKeystrokeString> = (props) => {
  const changeString = (text: string) => {
    props.onChange(new HotkeyKeystrokeString(text, props.keystroke.delay, props.keystroke.id));
  }

  const changeDelay = (delay: number) => {
    props.onChange(new HotkeyKeystrokeString(props.keystroke.text, delay, props.keystroke.id))
  }

  return (
    <Split direction="row">
      <Child grow padding="0 1rem 0 0">
        <Input value={props.keystroke.text} onChange={(e) => changeString(e.target.value)} />
      </Child>
      <Child basis="15%" padding="0 1rem 0 0">
        <Tooltip
          title="Delay between each keystroke"
        >
          <Input value={props.keystroke.delay} onChange={(e) => changeDelay(Math.round(parseInt(e.target.value)) || 0)} />
        </Tooltip>
      </Child>
      <Child>
        <span>ms</span>
      </Child>
    </Split>
  )
}