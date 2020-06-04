import React, { useContext } from 'react'
import * as lodash from 'lodash';

import ButtonContextMenu from '../ContextMenu/button';
import {MenuContext, MidiContext,LayoutContext, AudioContext, useModal } from '@lunchpad/contexts';
import { Button } from '@lunchpad/types';
import { useSettings } from '@lunchpad/hooks';
import { settingsLabels } from '@lunchpad/types'
import Settings from '../Settings';
import ConfigDialog from '../ButtonConfiguration';

import * as Devices from '@lunchpad/controller';
import { IPad } from '@lunchpad/controller';

export default () => {
  const [ mode ] = useSettings(settingsLabels.mode, "Software");
  const [ controller, setController ] = useSettings(settingsLabels.controller, "Software6x6");

  const [ pad, setPad ] = React.useState<IPad>();
  const { onButtonPressed, output } = React.useContext(MidiContext.Context);
  const { setButton, clearButton, activePage } = React.useContext(LayoutContext.Context);

  const [ openSettings, closeSettings ] = useModal();
  const { showContextMenu, closeMenu } = useContext(MenuContext.Context);
  const [ showConfigDialog, closeConfigDialog ] = useModal();
  
  const Component = pad?.Component
  // Repaint the Pad when the active layout changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    const Launchpad = Devices[controller as string] as IPad
    if (Launchpad) {
      setPad(Launchpad)
    }
  }, [ controller ])

  React.useEffect(() => {
    if (output) pad.buildColors(output, activePage);
  })

  const handleContextMenu = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>, x: number, y: number, id: number) => {
    showContextMenu(e.clientX, e.clientY, (
      <ButtonContextMenu
        onSelect={(x, y, key, value) => {
          if (key === "clearButton") {
            clearButton(x, y, activePage.id);
          } else if (key === "editButton") {
            const pageId = activePage.id
            const button = lodash.get(activePage, `buttons.${x}.${y}`, new Button("",x,y));
            showConfigDialog(
              <ConfigDialog
                button={button}
                onCancel={() => closeConfigDialog()}
                onAccept={(button) => {
                  console.log(button)
                  setButton(button, button.x, button.y, pageId)
                  closeConfigDialog()
                }}
              />
            )
          }
        }}
        onClose={closeMenu}
        x={x}
        y={y}
      />
    ))
  }

  return Component ? (
    <Component
      activePage={activePage}
      onButtonPressed={(e, x, y) => {
        /* setButton(new Button(
          "Test",
          x,
          y,
          {
            r: Math.floor(Math.random() * 255),
            g: Math.floor(Math.random() * 255),
            b: Math.floor(Math.random() * 255),
          }
        ), x, y, activePage.id) */
        onButtonPressed(e, pad.XYToButton(x,y))
      }}
      onSettingsButtonClick={() => openSettings(<Settings onClose={() => closeSettings()} />)}
      onContextMenu={handleContextMenu}
    />
  ) : (
    <div />
  )
}