import React from 'react';

import { IconVolumeUp, IconMap, IconTerminal, IconKeyboard, IconStopwatch, IconTrafficLightStop, IconComment } from '@lunchpad/icons';

import { MenuParent, MenuItem, MenuDivider } from '@lunchpad/base'
import { ActionType } from '@lunchpad/types';

export default ({ onSelect, onClose }) => {
  return (
    <MenuParent
      onClick={(e, id) => {
        e.stopPropagation();
        onSelect(id, undefined)
        onClose(e)
      }}
    >
      <MenuItem id={ActionType.Delay}><IconStopwatch />Delay</MenuItem>
      <MenuItem id={ActionType.PlaySound}><IconVolumeUp />Play a sound</MenuItem>
      <MenuItem id={ActionType.SwitchPage}><IconMap />Switch active page</MenuItem>
      {/* <MenuItem id={ActionType.StopAllSounds}><IconMute />Stop all sounds</MenuItem> */}
      <MenuItem id={ActionType.TextToSpeech}><IconComment />Text-to-speech</MenuItem>
      <MenuItem id={ActionType.LaunchApplication}><IconTerminal />Launch application</MenuItem>
      {/* <MenuItem id={ActionType.PerformWebrequest}><IconGloba />Perform a webrequest</MenuItem> */}
      <MenuItem id={ActionType.PressAHotkey}><IconKeyboard />Hotkey sequence</MenuItem>
      <MenuDivider />
      <MenuItem id={ActionType.StopAllMacros}><IconTrafficLightStop />Stop all macros</MenuItem>
      <MenuItem id={ActionType.StopThisMacro}><IconTrafficLightStop />Stop this macro</MenuItem>
      <MenuItem id={ActionType.RestartThisMacro}><IconTrafficLightStop />Restart this macro</MenuItem>
    </MenuParent>
  )
}