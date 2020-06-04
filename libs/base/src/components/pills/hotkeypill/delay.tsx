import * as React from 'react';

import { HotkeyKeystrokeDelay } from '@lunchpad/types';

import { Split, Child } from '../../basic/layout';

import { Input } from '../../basic';

export interface IHotkeyKeystrokeDelay {
  keystroke: HotkeyKeystrokeDelay
  onChange: (keystroke: HotkeyKeystrokeDelay) => void
}

export const HotkeyKeystrokeDelayElement: React.SFC<IHotkeyKeystrokeDelay> = ({ keystroke, onChange }) => {
  const changeDelay = (delay: number) => {
    onChange(new HotkeyKeystrokeDelay(delay, keystroke.id));
  }

  return (
    <Split direction="row">
      <Child grow padding="0 1rem 0 0">
        <Input value={keystroke.delay} onChange={(e) => changeDelay(Math.round(parseInt(e.target.value)) || 0)} />
      </Child>
      <Child><span style={{ whiteSpace: "nowrap"}}>milliseconds (ms)</span></Child>
    </Split>
  )
}