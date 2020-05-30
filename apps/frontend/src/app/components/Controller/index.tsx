import React, { useContext } from 'react'
import * as _ from 'lodash';

import ButtonContextMenu from '../ContextMenu/button';
import {MenuContext, MidiContext,LayoutContext, AudioContext, useModal } from '@lunchpad/contexts';
import { Button } from '@lunchpad/types';
import { useSettings } from '@lunchpad/hooks';
import { settingsLabels } from '@lunchpad/types'
import Settings from '../Settings';
import ConfigDialog from '../ButtonConfiguration';

import * as Devices from '@lunchpad/controller';

export default () => {
  const [ mode ] = useSettings(settingsLabels.mode, "software");
  const [ controller, setController ] = useSettings(settingsLabels.controller, "4x4");

  const [ pad, setPad ] = React.useState<Devices.ILaunchpad | false>(false);
  const { onButtonPressed, output, emitter } = React.useContext(MidiContext.Context);
  const { setButton, clearButton, activePage } = React.useContext(LayoutContext.Context);

  const [ openSettings, closeSettings ] = useModal();
  const { showContextMenu, closeMenu } = useContext(MenuContext.Context);
  const [ showConfigDialog, closeConfigDialog ] = useModal();
  
  
  // Repaint the Pad when the active layout changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    console.log(mode, controller, output)
    if (mode === "software") {
      setController("");
      return;
    }
    
    if (output) {
      if (!pad) {
        const Launchpad: Devices.ILaunchpad = Devices[controller]
        console.log(controller)
        if (Launchpad) {
          setPad(Launchpad)
          Launchpad.buildColors(output, activePage)
        }
      } else {
        pad.buildColors(output, activePage)
      }
    }
  })

  React.useEffect(() => {
    const pressed = (note, sw) => {
      console.log(note)
    }
    
    const released = (note) => {
      console.log(note)
    }
    
    emitter.on('ButtonPressed', pressed)
    emitter.on('ButtonReleased', released)

    return () => {
      emitter.removeListener('ButtonPressed', pressed)
      emitter.removeListener('ButtonReleased', released)
    }
  }, [ emitter ])

  const handleContextMenu = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>, x: number, y: number, id: number) => {
    showContextMenu(e.clientX, e.clientY, (
      <ButtonContextMenu
        onSelect={(x, y, key, value) => {
          if (key === "clearButton") {
            clearButton(x, y, activePage.id);
          } else if (key === "editButton") {
            const pageId = activePage.id
            const button = activePage.buttons[x][y] ?? new Button("",x,y)
            showConfigDialog(
              <ConfigDialog
                button={button}
                onCancel={() => closeConfigDialog()}
                onAccept={(button) => {
                  console.log(button)
                  setButton(button, button.x, button.y, pageId)
                  closeConfigDialog()}
                }
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

  return (
    <Devices.LaunchpadMiniMK3.Component
      activePage={activePage}

      onButtonPressed={(e, x, y) => {
        
        setButton(new Button(
          "Test",
          x,
          y,
          {
            r: Math.floor(Math.random() * 255),
            g: Math.floor(Math.random() * 255),
            b: Math.floor(Math.random() * 255),
          }
        ), x, y, activePage.id)
        onButtonPressed(e, Devices.LaunchpadMK2.XYToButton(x,y))
      }}
      onSettingsButtonClick={() => openSettings(<Settings onClose={() => closeSettings()} />)}
      onContextMenu={handleContextMenu}
    />
  );
}