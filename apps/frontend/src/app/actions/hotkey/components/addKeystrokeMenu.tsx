import * as React from 'react';

import {
  Icon,
  Keyboard,
  Stopwatch,
  ButtonUp,
  ButtonDown,
  ButtonDownUp,
} from '@lunchpad/icons';

import { MenuParent, MenuItem, MenuDivider } from '@lunchpad/base';
import { HotkeyKeystrokeType } from '../classes';

interface IAddKeystrokeMenu {
  onSelect: (id: string) => void;
  onClose: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
}

export const AddKeystrokeMenu: React.SFC<IAddKeystrokeMenu> = ({ onSelect, onClose }) => {
  return (
    <MenuParent
      onClick={(e, id) => {
        e.stopPropagation();
        onSelect(id)
        onClose(e)
      }}
    >
      <MenuItem id={HotkeyKeystrokeType.Delay}><Icon icon={Stopwatch} />Add a delay</MenuItem>
      <MenuItem id={HotkeyKeystrokeType.String}><Icon icon={Keyboard} />Type a text</MenuItem>
      <MenuDivider />
      <MenuItem id={HotkeyKeystrokeType.SimpleDown}><Icon icon={ButtonDown} />Press and hold key</MenuItem>
      <MenuItem id={HotkeyKeystrokeType.SimpleUp}><Icon icon={ButtonUp} />Release key</MenuItem>
      <MenuItem id={HotkeyKeystrokeType.SimpleDownUp}><Icon icon={ButtonDownUp} />Tap key</MenuItem>
    </MenuParent>
  )
}