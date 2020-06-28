import * as React from 'react';

import { Split, Child, Input } from '@lunchpad/base';
import { HotkeyKeystrokeDelay } from '../classes';

export interface IHotkeyKeystrokeDelay {
  keystroke: HotkeyKeystrokeDelay
  onChange: (keystroke: HotkeyKeystrokeDelay) => void
}

export const HotkeyKeystrokeDelayElement: React.SFC<IHotkeyKeystrokeDelay> = (props) => {
  const changeDelay = (delay: number) => {
    props.onChange(new HotkeyKeystrokeDelay(delay, props.keystroke.id));
  }

  return (
    <Split direction="row">
      <Child grow padding="0 1rem 0 0">
        <Input value={props.keystroke.delay} onChange={(e) => changeDelay(Math.round(parseInt(e.target.value)) || 0)} />
      </Child>
      <Child><span style={{ whiteSpace: "nowrap"}}>milliseconds (ms)</span></Child>
    </Split>
  )
}