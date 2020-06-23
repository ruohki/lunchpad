import React, { useContext } from 'react'
import * as lodash from 'lodash';

import { v4 as uuid } from 'uuid';

import { useSettings } from '@lunchpad/hooks';
import ButtonContextMenu from '../ContextMenu/button';
import {MenuContext, MidiContext,LayoutContext, NotificationContext, AudioContext, useModal } from '@lunchpad/contexts';
import { LaunchpadButton, PlaySound, FileURI, ActionType, PushToTalkStart, PushToTalkEnd, LaunchpadButtonLookText, LaunchpadButtonLookType } from '@lunchpad/types';
import { settingsLabels } from '@lunchpad/types'
import Settings from '../Settings';
import ConfigDialog from '../ButtonConfiguration';

import * as Devices from '@lunchpad/controller';
import { IPad } from '@lunchpad/controller';

import { MacroContext } from '../../contexts/macroengine';

const { remote } = window.require('electron');

const v4 = new RegExp(/([0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12})/ig);

interface ILocation {
  x: number
  y: number
}



export default () => {
  const [ mode ] = useSettings(settingsLabels.mode, "Software");
  const [ controller, setController ] = useSettings(settingsLabels.controller, "Software6x6");
  const [ showIcons ] = useSettings(settingsLabels.icons, "true");
  const { addNotification } = React.useContext(NotificationContext.Context)
  const { showContextMenu, closeMenu } = useContext(MenuContext.Context);
  const { emitter: MidiEmitter, sendSysEx, pressed } = React.useContext(MidiContext.Context);
  const { setButton, clearButton, activePage } = React.useContext(LayoutContext.Context);
  const { running, stopAll, stopSpecific } = React.useContext(MacroContext.Context);

  const [ openSettings, closeSettings ] = useModal();
  const [ showConfigDialog, closeConfigDialog ] = useModal();
  
  const [ pad, setPad ] = React.useState<IPad>();
  
  const Component = React.useMemo(() => pad?.Component, [ pad ]);
  // Repaint the Pad when the active layout changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    const Launchpad = Devices[controller as string] as IPad
    if (Launchpad) {
      if (pad) pad.unload(sendSysEx);
      Launchpad.initialize(sendSysEx);
      setPad(Launchpad)
    }

    return () => {
      if (Launchpad) Launchpad.unload(sendSysEx);
    }
  }, [ controller ])


  React.useEffect(() => {
    if (pad && pad.buildColors) {
      pad.buildColors(sendSysEx, activePage, Array.from( running ).map(([key, value]) => ({ x: value.x, y: value.y })));
    }
  }, [ running, pad, activePage ]);

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

    const button = lodash.get(activePage, `buttons.${x}.${y}`, new LaunchpadButton());
    stopSpecific(x, y);
    showConfigDialog(
      <ConfigDialog
        limitedColor={limitedColor}
        button={button}
        onCancel={() => closeConfigDialog()}
        onAccept={(button) => {
          setButton(button, x, y, pageId)
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
              let newBtn = JSON.parse(remote.clipboard.readText('clipboard')) as LaunchpadButton;
              if (("look" in newBtn) && ("color" in newBtn) && ("down" in newBtn)) {
                const button = Object.assign(new LaunchpadButton(), newBtn);
                setButton(button, x,y, activePage.id);
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
    const soundOutput = localStorage.getItem(settingsLabels.soundOutput) ?? "default"
    const enablePtt = localStorage.getItem(settingsLabels.ptt.enabled) ?? "false"
    if ('files' in payload) {
      const ButtonTarget = Object.assign<Object, LaunchpadButton>({}, lodash.get(activePage, `buttons.${a.x}.${a.y}`));
      //D&D a file
      if (lodash.isEmpty(ButtonTarget)) {
        //@ts-ignore
        const name = payload.files[0].name.split('.').slice(0, -1).join('.')
        const button = new LaunchpadButton();
        button.look = new LaunchpadButtonLookText(name);
        //@ts-ignore
        const pttStart = new PushToTalkStart();
        const pttEnd = new PushToTalkEnd(pttStart.id);
        pttStart.endId = pttEnd.id;

        if (enablePtt === "true") button.down.push(pttStart);
        //@ts-ignore
        button.pressed.push(new PlaySound(FileURI(payload.files[0].path), soundOutput))
        if (enablePtt === "true") button.down.push(pttEnd);

        setButton(button, a.x, a.y, activePage.id);
        editButton(a.x, a.y);
      } else {
        stopSpecific(a.x, a.y);
        const playSoundIdx = ButtonTarget.down.findIndex(action => action.type === ActionType.PlaySound);
        if (playSoundIdx !== -1) {
          // TODO: Clean way
          //@ts-ignore
          const name = payload.files[0].name.split('.').slice(0, -1).join('.')
          if (ButtonTarget.look.type === LaunchpadButtonLookType.Text) {
            const look = ButtonTarget.look as LaunchpadButtonLookText
            look.caption = name;
            ButtonTarget.look = look;
          }
          //@ts-ignore
          ButtonTarget.down[playSoundIdx].soundfile = FileURI(payload.files[0].path);
          //@ts-ignore
          ButtonTarget.down[playSoundIdx].start = 0;
          //@ts-ignore
          ButtonTarget.down[playSoundIdx].end = 1;

          setButton(ButtonTarget, a.x, a.y, activePage.id);
        }
      }
    } else if (payload.type === "BUTTON") {
      const ButtonTarget = Object.assign<Object, LaunchpadButton>({}, lodash.get(activePage, `buttons.${a.x}.${a.y}`));
      const ButtonSource = Object.assign<Object, LaunchpadButton>({}, lodash.get(activePage, `buttons.${payload.x}.${payload.y}`))

      stopSpecific(parseInt(payload.x), parseInt(payload.y));
      stopSpecific(a.x, a.y);

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
      showIcons={showIcons === "true"}
      activePage={activePage}
      onButtonPressed={(e, x, y, note, cc) => {
        if (e.button === 0) MidiEmitter.emit('onButtonDown', note, cc)
      }}
      onButtonReleased={(e, x, y, note, cc) => {
        if (e.button === 0) MidiEmitter.emit('onButtonUp', note, cc)
      }}
      onSettingsButtonClick={() => openSettings(<Settings onClose={() => closeSettings()} />)}
      onContextMenu={handleContextMenu}
      onDrop={onDrop}
      onDragStart={stopSpecific}
      onDragEnd={stopSpecific}
    />
  ) : (
    <div />
  )
}