import React, { useContext } from 'react'
import * as lodash from 'lodash';

import { v4 as uuid } from 'uuid';

import ButtonContextMenu from '../ContextMenu/button';
import {MenuContext, MidiContext,LayoutContext, NotificationContext, AudioContext, useModal } from '@lunchpad/contexts';
import { Button, PlaySound, FileURI } from '@lunchpad/types';
import { useSettings } from '@lunchpad/hooks';
import { settingsLabels } from '@lunchpad/types'
import Settings from '../Settings';
import ConfigDialog from '../ButtonConfiguration';

import * as Devices from '@lunchpad/controller';
import { IPad } from '@lunchpad/controller';

const { remote } = window.require('electron');

const v4 = new RegExp(/([0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12})/ig);

interface ILocation {
  x: number
  y: number
}

export default () => {
  const [ mode ] = useSettings(settingsLabels.mode, "Software");
  const [ controller, setController ] = useSettings(settingsLabels.controller, "Software6x6");
  const { addNotification } = React.useContext(NotificationContext.Context)
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
    if (pad && pad.buildColors) {
      if (output) pad.buildColors(output, activePage);
    }
  })

  const copyButton = (x: number, y: number) => {
    let btn = Object.assign({}, lodash.get(activePage, `buttons.${x}.${y}`, undefined))
    if (btn) {
      delete(btn.x);
      delete(btn.y);
      // Generate new uuid's for all occurences
      const json = JSON.stringify(btn).replace(v4, (match) => uuid());
      remote.clipboard.writeText(json, "clipboard");
    }
  }

  const editButton = (x: number, y: number, limitedColor = false) => {
    const pageId = activePage.id
    const button = lodash.get(activePage, `buttons.${x}.${y}`, new Button("",x,y));
    showConfigDialog(
      <ConfigDialog
        limitedColor={limitedColor}
        button={button}
        onCancel={() => closeConfigDialog()}
        onAccept={(button) => {
          setButton(button, button.x, button.y, pageId)
          closeConfigDialog()
        }}
      />
    )
  }
  const handleContextMenu = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>, x: number, y: number, id: number) => {
    showContextMenu(e.clientX, e.clientY, (
      <ButtonContextMenu
        onSelect={(x, y, key, value) => {
          if (key === "clearButton") {
            clearButton(x, y, activePage.id);
            addNotification(`Button (${x},${y}) cleared`, 1000)
          } else if (key === "copyButton") {
            copyButton(x, y)
            addNotification(`Button (${x},${y}) copied`, 1000)
          } else if (key === "pasteButton") {
            try {
              let newBtn = JSON.parse(remote.clipboard.readText('clipboard'));
              if (("title" in newBtn) && ("color" in newBtn) && ("pressed" in newBtn)) {
                const btn = new Button(newBtn.title, x, y, newBtn.color);
                btn.pressed = newBtn.pressed;
                setButton(btn, x,y, activePage.id);
                addNotification(`Pasted button into (${x},${y})`, 1000)
              }
            } catch (ex) {}
          } else if (key === "cutButton") {
            copyButton(x, y);
            clearButton(x,y,activePage.id);
            addNotification(`Button (${x},${y}) was cut`, 1000)
          } else if (key === "editButton") {
            editButton(x, y, pad.limitedColor);
          }
        }}
        onClose={closeMenu}
        x={x}
        y={y}
      />
    ))
  }

  const onDrop = (a: ILocation, payload: Record<string, string>) => {
    if ('files' in payload) {
      const ButtonTarget = Object.assign<Object, Button>({}, lodash.get(activePage, `buttons.${a.x}.${a.y}`));
      //D&D a file
      if (lodash.isEmpty(ButtonTarget)) {
        //@ts-ignore
        const name = payload.files[0].name.split('.').slice(0, -1).join('.')
        const button = new Button(name, a.x, a.y);
        //@ts-ignore
        button.pressed.push(new PlaySound(FileURI(payload.files[0].path)))

        setButton(button, a.x, a.y, activePage.id);
        editButton(a.x, a.y);
      } else {

      }
    } else if (payload.type === "BUTTON") {
      const ButtonTarget = Object.assign<Object, Button>({}, lodash.get(activePage, `buttons.${a.x}.${a.y}`));
      const ButtonSource = Object.assign<Object, Button>({}, lodash.get(activePage, `buttons.${payload.x}.${payload.y}`))

      if (ButtonTarget && lodash.isEmpty(ButtonSource)) {
        setButton(ButtonTarget, parseInt(payload.x), parseInt(payload.y), activePage.id);
        clearButton(a.x, a.y, activePage.id);
      } else if (ButtonSource && lodash.isEmpty(ButtonTarget)) {
        setButton(ButtonSource, a.x, a.y, activePage.id);
        clearButton(parseInt(payload.x), parseInt(payload.y), activePage.id);
      } else {
        setButton(ButtonTarget, parseInt(payload.x), parseInt(payload.y), activePage.id);
        setButton(ButtonSource, a.x, a.y, activePage.id);
      }
    }
  }

  return Component ? (
    <Component
      activePage={activePage}
      onButtonPressed={(e, x, y, note, cc) => onButtonPressed(e, pad.XYToButton(x,y), cc)}
      onSettingsButtonClick={() => openSettings(<Settings onClose={() => closeSettings()} />)}
      onContextMenu={handleContextMenu}
      onDrop={onDrop}
    />
  ) : (
    <div />
  )
}