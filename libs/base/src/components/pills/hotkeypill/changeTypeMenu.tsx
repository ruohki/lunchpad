import * as React from 'react';

import {
  IconKeyboard,
  IconStopwatch,
  IconSortAlt,
  IconLongArrowAltDown,
  IconLongArrowAltUp
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
      <MenuItem id={HotkeyKeystrokeEvent.KeyDown}><IconLongArrowAltDown />Press and hold key</MenuItem>
      <MenuItem id={HotkeyKeystrokeEvent.KeyUp}><IconLongArrowAltUp />Release key</MenuItem>
      <MenuItem id={HotkeyKeystrokeEvent.KeyDownUp}><IconSortAlt />Tap key</MenuItem>
    </MenuParent>
  )
}