import React from 'react';

import { IconVolumeUp, IconMute, IconTerminal, IconGloba, IconKeyboard } from '@lunchpad/icons';

import { MenuParent, MenuItem, MenuDivider, VolumeParent } from './components'
import { ActionType } from '@lunchpad/types';

interface IMenu {
  x: number
  y: number
  onSelect: (x: number, y: number, key: string, value: string | number | object | undefined) => void
  onClose: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void
}

export default ({ onSelect, onClose }) => {
  return (
    <MenuParent
      onClick={(e, id) => {
        e.stopPropagation();
        onSelect(id, undefined)
        onClose(e)
      }}
    >
      <MenuItem id={ActionType.PlaySound}><IconVolumeUp />Play a sound</MenuItem>
      <MenuItem id={ActionType.StopAllSounds}><IconMute />Stop all sounds</MenuItem>
      <MenuItem id={ActionType.LaunchApplication}><IconTerminal />Launch a shell command</MenuItem>
      <MenuItem id={ActionType.PerformWebrequest}><IconGloba />Perform a webrequest</MenuItem>
      <MenuItem id={ActionType.PressAHotkey}><IconKeyboard />Press a hotkey</MenuItem>
    </MenuParent>
  )
}