import React, { useContext } from 'react'
import * as lodash from 'lodash';

import { v4 as uuid } from 'uuid';
import { deserialize } from 'typescript-json-serializer';

import { useSettings, useLocalStorage } from '@lunchpad/hooks';
import ButtonContextMenu from '../ContextMenu/button';
import { MenuContext, MidiContext, NotificationContext, useModal } from '@lunchpad/contexts';
import { FileURI } from '@lunchpad/types';
import { settingsLabels } from '@lunchpad/types'
import Settings from '../Settings';
import ConfigDialog from '../ButtonConfiguration';

import * as Devices from '../../controller';

import { Playground } from '../../contexts/playground';
import { MacroContext } from '../../contexts/macro/index';
import { LayoutContext } from '../../contexts/layout';
import { LaunchpadButton, LaunchpadButtonLookText, LaunchpadButtonLookType, LaunchpadSolidButtonColor } from '../../contexts/layout/classes';
import { PushToTalkEnd, PushToTalkStart } from '../../actions/pushtotalk';
import { ActionType } from '../../actions';
import { PlaySound } from '../../actions/playsound';


const { remote } = window.require('electron');

const v4 = new RegExp(/([0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12})/ig);

interface ILocation {
  x: number
  y: number
}



export default () => {
  const [ controller ] = useLocalStorage<string>(settingsLabels.controller, "Software6x6");
  const [ showIcons ] = useLocalStorage<boolean>(settingsLabels.icons, true);
  const { addNotification  } = React.useContext(NotificationContext.Context)
  const { showContextMenu, closeMenu } = useContext(MenuContext.Context);
  const { emitter: MidiEmitter, sendSysEx, currentInput, currentOutput } = React.useContext(MidiContext.Context);
  const { setButton, clearButton, activePage } = React.useContext(LayoutContext.Context);
  const { running, stopAll, stopSpecific } = React.useContext(MacroContext.Context);

  const [ openSettings, closeSettings ] = useModal();
  const [ showConfigDialog, closeConfigDialog ] = useModal();
  
  const [ pad, setPad ] = React.useState<Devices.IPad>();
  
  const [ showDnDNotification ] = NotificationContext.useNotification();

  const Component = React.useMemo(() => pad?.Component, [ pad ]);
  // Repaint the Pad when the active layout changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    const Launchpad = Devices[controller as string] as Devices.IPad
    if (Launchpad) {
      if (pad) pad.unload(sendSysEx);
      Launchpad.initialize(sendSysEx);
      setPad(Launchpad)
    }

    return () => {
      if (Launchpad) Launchpad.unload(sendSysEx);
    }
  }, [ controller, currentInput, currentOutput ])

  React.useEffect(() => {
    if (pad && pad.buildColors) {
      pad.buildColors(sendSysEx, activePage, Array.from( running ).map(([key, value]) => ({ x: value.x, y: value.y })));
    }
  });

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
              let newBtn = deserialize<LaunchpadButton>(JSON.parse(remote.clipboard.readText('clipboard')), LaunchpadButton)
              
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

  const onDrop = (a: ILocation, payload: Record<string, string>, modifier: string) => {
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
        button.color = new LaunchpadSolidButtonColor(Math.ceil(Math.random() * 127))
        //@ts-ignore
        const pttStart = new PushToTalkStart();
        const pttEnd = new PushToTalkEnd(pttStart.id);
        pttStart.endId = pttEnd.id;
        
        if (enablePtt === "true") button.down.push(pttStart);
        //@ts-ignore
        button.down.push(new PlaySound(FileURI(payload.files[0].path), soundOutput))
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

      /* if (ButtonTarget && lodash.isEmpty(ButtonSource)) {
        setButton(ButtonTarget, parseInt(payload.x), parseInt(payload.y), activePage.id);
        clearButton(a.x, a.y, activePage.id);
      } else  */
      if (ButtonSource && lodash.isEmpty(ButtonTarget)) {
        setButton(ButtonSource, a.x, a.y, activePage.id);
        if (modifier === "ctrl") clearButton(parseInt(payload.x), parseInt(payload.y), activePage.id);
      } else {
        if (modifier === "ctrl") setButton(ButtonTarget, parseInt(payload.x), parseInt(payload.y), activePage.id);
        setButton(ButtonSource, a.x, a.y, activePage.id);
      }
    }
  }

  return Component ? (
    <Component
      showIcons={showIcons}
      activePage={activePage}
      onSettingsButtonClick={() => openSettings(<Settings onClose={() => closeSettings()} />)}
      buttonProps={{
        onMouseDown: (e, x, y, note, cc) => {
          if (e.button === 0) MidiEmitter.emit('onButtonDown', note, cc)
        },
        onMouseUp: (e, x, y, note, cc) => {
          if (e.button === 0) MidiEmitter.emit('onButtonUp', note, cc)
        },
        onContextMenu: handleContextMenu,
        onDrop,
        onDragStart: stopSpecific,
        onDragEnd: (x: number, y: number, modifier: string) => {
          if (modifier === "") {
            addNotification("To move a button hold down the [<span style=\"color: var(--COLOR_BLURPLE)\">control</span>] key, the [<span style=\"color: var(--COLOR_BLURPLE)\">alt</span>] key will create a copy.", 2500)
          }
        },
      }}
    />
  ) : (
    <div />
  )
}