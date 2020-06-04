import * as React from 'react';

import {
  IconKeyboard,
  IconStopwatch,
  IconSortAlt,
  IconLongArrowAltDown,
  IconLongArrowAltUp
} from '@lunchpad/icons';

import { HotkeyKeystrokeEvent, HotkeyKeystrokeType } from '@lunchpad/types';

import { MenuParent, MenuItem, MenuDivider } from '../../basic';

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
      <MenuItem id={HotkeyKeystrokeType.Delay}><IconStopwatch />Add a delay</MenuItem>
      <MenuItem id={HotkeyKeystrokeType.String}><IconKeyboard />Type a text</MenuItem>
      <MenuDivider />
      <MenuItem id={HotkeyKeystrokeType.SimpleDown}><IconLongArrowAltDown />Press and hold key</MenuItem>
      <MenuItem id={HotkeyKeystrokeType.SimpleUp}><IconLongArrowAltUp />Release key</MenuItem>
      <MenuItem id={HotkeyKeystrokeType.SimpleDownUp}><IconSortAlt />Tap key</MenuItem>
    </MenuParent>
  )
}