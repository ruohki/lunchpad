import React, { useContext } from 'react'

import LaunchpadMK2 from './launchpadmk2'
import ButtonContextMenu from '../ContextMenu/button';

import { store as ContextMenuStore } from '../ContextMenu';

export default () => {
  const { showContextMenu } = useContext(ContextMenuStore);
  
  const handleContextMenu = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>, id: number) => {
    showContextMenu(e.clientX, e.clientY, ButtonContextMenu)
  }
  return (
    <>
      <LaunchpadMK2 onContextMenu={handleContextMenu} />
    </>
  );
  }