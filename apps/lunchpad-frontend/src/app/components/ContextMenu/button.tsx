import React from 'react';

import { MenuParent, MenuItem, MenuDivider, VolumeParent, VolumeBackground, VolumeFiller, VolumeKnob, Slider } from './components'
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import { faVolume, faEdit, faCopy, faPaste, faCut } from '@fortawesome/pro-light-svg-icons';
export default () => (
  <MenuParent
    onClick={(e, id) => {
      e.stopPropagation();
      console.log(id)
    }}
  >
    <VolumeParent>
      <Icon icon={faVolume} />
      <Slider />
      
    </VolumeParent>
    <MenuDivider />
    <MenuItem id="foo"><Icon icon={faEdit} />Edit button...</MenuItem>
    <MenuDivider />
    <MenuItem id="bar"><Icon icon={faCopy} />Copy button</MenuItem>
    <MenuItem id="hello"><Icon icon={faPaste} />Paste button</MenuItem>
    <MenuItem disabled id="hello"><Icon icon={faCut} />Cut button</MenuItem>
    <MenuDivider />
    <MenuItem id="muh">Clear button...</MenuItem>
  </MenuParent>
)