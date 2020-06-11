import React from 'react';
import * as lodash from 'lodash';

import * as Devices from '@lunchpad/controller';

import { MidiContext, LayoutContext, AudioContext } from '@lunchpad/contexts';
import { IPad } from '@lunchpad/controller';
import { useSettings } from '@lunchpad/hooks';
import { settingsLabels, Button, StopThisMacro, Action } from '@lunchpad/types';

import { MacroRunner } from '@lunchpad/macroengine'
import { uniqueId } from 'lodash';
import { MacroAction } from 'libs/macro/src/actions';

export const MacroEngine = () => {
  const { activePage } = React.useContext(LayoutContext.Context);
  const { emitter } = React.useContext(MidiContext.Context);
  const [ controller ] = useSettings(settingsLabels.controller, "Software6x6");
  const [ pad, setPad ] = React.useState<IPad>();

  React.useEffect(() => {
    const Launchpad = Devices[controller as string] as IPad
    if (Launchpad) {
      setPad(Launchpad)
    }
  }, [ controller ])

  React.useEffect(() => {
    if (!pad) return;
    const mm: Map<string, MacroRunner> = new Map();

    const pressed = (note, cc, sw) => {

      const [ x, y ] = pad.ButtonToXY(note, cc);
      const button = lodash.get(activePage, `buttons.${x}.${y}`) as Button;
      if (!button) return;
      
      
      const PlayMacro = (actions: Action[], loop: boolean, x: number, y: number) => {
        const id = uniqueId();
        const macro = new MacroRunner(actions, x, y);
        let cancel = false;

        mm.set(id, macro);
        macro.on('onStopButton', (x, y) => {
          cancel = true;
          const ids = [];
          mm.forEach(v => {
            if (v.x === x && v.y === y) {
              v.Stop();
              ids.push(v.id);
            }
          })
  
          ids.forEach(id => mm.delete(id));
        })
  
        macro.on('onRestartButton', (id, x, y) => {
          const ids = [];
          mm.forEach(v => {
            if ((v.x === x && v.y === y) && (v.id !== id)) {
              v.Stop();
              ids.push(v.id);
            }
          })
  
          ids.forEach(id => mm.delete(id));
        })
  
        macro.on('onStopAll', () => {
          cancel = true;
          mm.forEach(v => v.Stop());
          mm.clear();
        })
  
        macro.Run().then(() => {
          mm.delete(id)
          if (loop) {
            PlayMacro(actions, loop, x, y);
          }
        }).catch(() => {
          mm.delete(id);
        });
      }
      PlayMacro(button.pressed, button.loop, x, y);
    }
    
    const released = (note, cc) => {
      const [ x, y ] = pad.ButtonToXY(note, cc);
      const button = lodash.get(activePage, `buttons.${x}.${y}`) as Button;
      if (!button) return;
      
      const id = uniqueId();
      const macro = new MacroRunner(button.released, x, y);
      
      mm.set(id, macro);
      
      macro.on('onStopButton', (x, y) => {
        const ids = [];
        mm.forEach(v => {
          if (v.x === x && v.y === y) {
            v.Stop();
            ids.push(v.id);
          }
        })

        ids.forEach(id => mm.delete(id));
      })

      macro.on('onRestartButton', (id, x, y) => {
        const ids = [];
        mm.forEach(v => {
          if ((v.x === x && v.y === y) && (v.id !== id)) {
            v.Stop();
            ids.push(v.id);
          }
        })

        ids.forEach(id => mm.delete(id));
      })

      macro.on('onStopAll', () => {
        mm.forEach(v => v.Stop());
        mm.clear();
      })

      macro.Run().then(() => mm.delete(id)).catch(() => mm.delete(id));
    }
    
    emitter.on('ButtonPressed', pressed)
    emitter.on('ButtonReleased', released)

    return () => {
      emitter.removeListener('ButtonPressed', pressed)
      emitter.removeListener('ButtonReleased', released)
      mm.clear();
    }
  }, [ emitter, pad, activePage ])

  return <div />
}