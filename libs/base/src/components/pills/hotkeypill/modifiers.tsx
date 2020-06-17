
import * as React from 'react';
import * as lodash from 'lodash';

import { HotkeyKeystrokeSimple } from '@lunchpad/types';

import { Split, Child } from '../../basic/layout';
import { Tooltip, Switch } from '../../basic';

interface IModifiers {
  modifiers: string;
  onChange: (modifiers: string[]) => void
}

interface IModifier {
  text: string
  value: boolean
  onChange: (value: boolean) => void
}

const Modifier: React.SFC<IModifier> = ({ value, onChange, text }) => (
  <Split direction="row">
    <Child grow padding="0 0.5rem 0 0">{text}</Child>
    <Child><Switch value={value} onChange={onChange} /></Child>
  </Split>
)

const tryPrase = (val: any) => {
  try {
    return JSON.parse(val)
  } catch {
    return val
  }
}
export const Modifiers: React.SFC<IModifiers> = ({ modifiers, onChange }) => {
  const change = (modifier: string, value: boolean) => {
    
    let mods = modifiers || [];

    if (value) {
      //@ts-ignore
      mods = [modifier, ...mods.filter(m => m !== modifier)]
    } else {
      //@ts-ignore
      mods = [...mods.filter(m => m !== modifier)]
    }
    console.log(Array.from(mods.values()))
    onChange(Array.from(mods.values()));
  }

  return (
    <Split direction="row">
      <Child padding="0 1rem 0 0">
        <Tooltip title="Will hold down the [CONTROL / CTRL] key together with the defined key">
          <Modifier value={lodash.includes(modifiers, "control")} onChange={ctrl => change('control', ctrl)} text="C" />
        </Tooltip>
      </Child>
      <Child padding="0 1rem 0 0">
        <Tooltip title="Will hold down the [ALT] key together with the defined key">
          <Modifier value={lodash.includes(modifiers, "alt")} onChange={alt => change('alt', alt)} text="A" />
        </Tooltip>
      </Child>
      <Child padding="0">
        <Tooltip title="Will hold down the [LEFT SHIFT] key together with the defined key">
          <Modifier value={lodash.includes(modifiers, "shift")} onChange={shift => change('shift', shift)} text="S" />
        </Tooltip>
      </Child>
    </Split>
  )
}

