import React from 'react';

import { Icon, Stopwatch, Sound, PageOpen, TTS, Shell, Stop, Keyboard, ButtonDownUp, Light, FlipFlop, OBS } from '@lunchpad/icons';

import { MenuParent, MenuItem, MenuDivider, MenuGroup, ScrollBox, Divider } from '@lunchpad/base'
import { ActionType } from '../../actions';

export default ({ onSelect, onClose }) => {
  return (
    <MenuParent
      onClick={(e, id) => {
        e.stopPropagation();
        onSelect(id, undefined)
        onClose(e)
      }}
      height="400px"
    >
      <ScrollBox>
        <MenuGroup
          expanded
          header={<><Icon icon={Keyboard} />Generic Actions</>}
        >
          <MenuItem onClick={() => onSelect(ActionType.PlaySound)}><Icon icon={Sound} />Play a sound</MenuItem>
          <MenuItem onClick={() => onSelect(ActionType.TextToSpeech)}><Icon icon={TTS} />Text-to-speech</MenuItem>
          <MenuItem onClick={() => onSelect(ActionType.LaunchApplication)}><Icon icon={Shell} />Launch application</MenuItem>
          <MenuItem onClick={() => onSelect(ActionType.PressAHotkey)}><Icon icon={Keyboard} />Hotkey sequence</MenuItem>
          <MenuItem onClick={() => onSelect(ActionType.SwitchPage)}><Icon icon={PageOpen} />Switch active page</MenuItem>
        </MenuGroup>
        <MenuDivider />
        <MenuGroup
          expanded={false}
          header={<><Icon icon={FlipFlop} />Functionality</>}
        >
          <MenuItem onClick={() => onSelect(ActionType.FlipFlopStart)}><Icon icon={FlipFlop} />Flip flop</MenuItem>
          <MenuItem onClick={() => onSelect(ActionType.SetColor)}><Icon icon={Light} />Set button color</MenuItem>
          <MenuItem onClick={() => onSelect(ActionType.Delay)}><Icon icon={Stopwatch} />Delay</MenuItem>
          <MenuItem onClick={() => onSelect(ActionType.PushToTalkStart)}><Icon icon={ButtonDownUp} />Push-to-talk</MenuItem>
        </MenuGroup>
        {/* <MenuItem id={ActionType.PerformWebrequest}><IconGloba />Perform a webrequest</MenuItem> */}
        <MenuDivider />
        <MenuGroup
          expanded={false}
          header={<><Icon icon={OBS} />OBS Studio</>}
        >
          <MenuItem onClick={() => onSelect(ActionType.OBSSwitchScene)}><Icon icon={OBS} />Switch scene</MenuItem>
          <MenuItem onClick={() => onSelect(ActionType.OBSToggleMixer)}><Icon icon={OBS} />Set source volume</MenuItem>
          <Divider />
          <MenuItem onClick={() => onSelect(ActionType.OBSToggleSource)}><Icon icon={OBS} />Toggle source</MenuItem>
          <MenuItem onClick={() => onSelect(ActionType.OBSToggleFilter)}><Icon icon={OBS} />Toggle filter</MenuItem>
          <Divider />
          <MenuItem onClick={() => onSelect(ActionType.OBSStartStopStream)}><Icon icon={OBS} />Start/stop</MenuItem>
          <MenuItem onClick={() => onSelect(ActionType.OBSSaveReplayBuffer)}><Icon icon={OBS} />Save replay</MenuItem>
        </MenuGroup>
        <MenuDivider />
        <MenuGroup
          expanded={false}
          header={<><Icon icon={Stop} />Macro specific</>}
        >
          <MenuItem onClick={() => onSelect(ActionType.StopAllMacros)}><Icon icon={Stop} />Stop ALL macros</MenuItem>
          <MenuItem onClick={() => onSelect(ActionType.StopThisMacro)}><Icon icon={Stop} />Stop this macro</MenuItem>
          <MenuItem onClick={() => onSelect(ActionType.RestartThisMacro)}><Icon icon={Stop} />Restart this macro</MenuItem>
        </MenuGroup>
      </ScrollBox>
    </MenuParent>
  )
}