import * as React from 'react';

import {
  Icon,
  ButtonDown,
  ButtonUp,
  ButtonDownUp
} from '@lunchpad/icons';

import { HotkeyKeystrokeEvent } from '@lunchpad/types';

import { MenuParent, MenuItem } from '../../basic';

interface IChangeTypeMenu {
  onSelect: (id: string) => void;
  onClose: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
}

export const ChangeTypeMenu: React.SFC<IChangeTypeMenu> = ({ onSelect, onClose }) => {
  return (
    <MenuParent
      onClick={(e, id) => {
        e.stopPropagation();
        onSelect(id)
        onClose(e)
      }}
    >
      <MenuItem id={HotkeyKeystrokeEvent.KeyDown}><Icon icon={ButtonDown} />Press and hold key</MenuItem>
      <MenuItem id={HotkeyKeystrokeEvent.KeyUp}><Icon icon={ButtonUp} />Release key</MenuItem>
      <MenuItem id={HotkeyKeystrokeEvent.KeyDownUp}><Icon icon={ButtonDownUp} />Tap key</MenuItem>
    </MenuParent>
  )
}