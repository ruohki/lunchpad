import React from 'react';

import { Icon, Stopwatch, Sound, PageOpen, TTS, Shell, Stop, Keyboard, ButtonDownUp } from '@lunchpad/icons';

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
      <MenuItem id={ActionType.Delay}><Icon icon={Stopwatch} />Delay</MenuItem>
      <MenuItem id={ActionType.PlaySound}><Icon icon={Sound} />Play a sound</MenuItem>
      <MenuItem id={ActionType.PushToTalkStart}><Icon icon={ButtonDownUp} />Push-to-talk</MenuItem>
      <MenuItem id={ActionType.SwitchPage}><Icon icon={PageOpen} />Switch active page</MenuItem>
      <MenuItem id={ActionType.TextToSpeech}><Icon icon={TTS} />Text-to-speech</MenuItem>
      <MenuItem id={ActionType.LaunchApplication}><Icon icon={Shell} />Launch application</MenuItem>
      {/* <MenuItem id={ActionType.PerformWebrequest}><IconGloba />Perform a webrequest</MenuItem> */}
      <MenuItem id={ActionType.PressAHotkey}><Icon icon={Keyboard} />Hotkey sequence</MenuItem>
      <MenuDivider />
      <MenuItem id={ActionType.StopAllMacros}><Icon icon={Stop} />Stop ALL macros</MenuItem>
      <MenuItem id={ActionType.StopThisMacro}><Icon icon={Stop} />Stop this macro</MenuItem>
      <MenuItem id={ActionType.RestartThisMacro}><Icon icon={Stop} />Restart this macro</MenuItem>
    </MenuParent>
  )
}