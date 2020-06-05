import React from 'react';
import * as lodash from 'lodash';

import * as Devices from '@lunchpad/controller';

import { MidiContext, LayoutContext, AudioContext } from '@lunchpad/contexts';
import { IPad } from '@lunchpad/controller';
import { useSettings } from '@lunchpad/hooks';
import { settingsLabels, Button } from '@lunchpad/types';

import { MacroRunner } from '@lunchpad/macroengine'
import { uniqueId } from 'lodash';

export const MacroEngine = () => {
  const { activePage } = React.useContext(LayoutContext.Context);
  const { emitter } = React.useContext(MidiContext.Context);
  const [ controller ] = useSettings(settingsLabels.controller, "Software6x6");
  const [ pad, setPad ] = React.useState<IPad>();

  //const [ macros, setMacros ] = React.useState<Macro[]>([]);

  React.useEffect(() => {
    const Launchpad = Devices[controller as string] as IPad
    if (Launchpad) {
      setPad(Launchpad)
    }
  }, [ controller ])

  React.useEffect(() => {
    if (!pad) return;
    const mm: Map<string, MacroRunner> = new Map();

    const pressed = (note, sw) => {
      const [ x, y ] = pad.ButtonToXY(note);
      const button = lodash.get(activePage, `buttons.${x}.${y}`) as Button;
      if (!button) return;
      
      const id = uniqueId();
      const macro = new MacroRunner(button.pressed);
      
      mm.set(id, macro);
      
      macro.on('onStopAll', () => {
        mm.forEach(v => v.Stop());
        mm.clear();
      })

      macro.Run().then(() => {
        mm.delete(id)
      });
      
    }
    
    const released = (note) => {
      //console.log(note, pad.ButtonToXY(note))
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