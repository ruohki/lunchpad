//TODO: Pass down class instead of using event emitter

import * as React from 'react';
import lodash from 'lodash';

import * as Devices from '@lunchpad/controller';

import { MidiContext, LayoutContext } from '@lunchpad/contexts';
import { IPad } from '@lunchpad/controller';
import { useSettings } from '@lunchpad/hooks';
import { settingsLabels, Action, LaunchpadButton, ipcLabels } from '@lunchpad/types';

import { MacroRunner } from '@lunchpad/macroengine'
import { uniqueId } from 'lodash';
import { Counter } from './counter';
import { PushToTalk } from './pushtotalk';

const { ipcRenderer } = window.require('electron');

export interface IMacroContext {
  running: Map<string, MacroRunner>
  stopAll: () => void
  stopSpecific: (x: number, y: number) => void
}

const macroContext = React.createContext<Partial<IMacroContext>>({})
const { Provider } = macroContext;

const MacroProvider = ({ children }) => {
  const [ running, setCurrentMacros ] = React.useState<Map<string, MacroRunner>>(new Map([]));
  
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

  const stopAll = () => {
    running.forEach(r => r.Stop());
    clearRunner();
  }

  const stopSpecific = (x: number, y: number): void => {
    running.forEach(r => (r.x === x && r.y === y) ? r.Stop() : lodash.noop())
  }

  const addRunner = React.useCallback((id: string, runner: MacroRunner, oldId: (string | false) = false) => {
    let run = new Map(running.set(id, runner))
    //if (oldId) run.delete(oldId);
    setCurrentMacros(run);
  }, [ running ]);

  const removeRunner = React.useCallback((id: string) => {
    const removed = running.delete(id)
    if (removed) {
      setCurrentMacros(new Map(running));
    }
  }, [ running ])

  const clearRunner = React.useCallback(() => {
    running.forEach(v => v.Stop());
    running.clear();
    setCurrentMacros(new Map(running));
  }, [ running ])

  React.useEffect(() => {
    if (!pad) return;

    const PTTCounter = new Counter(0);
    const pushToTalk = new PushToTalk();
    
    ipcRenderer.on(ipcLabels.macros.stopAll, stopAll);

    const pressed = (note: number, cc: boolean) => {
      const [ x, y ] = pad.ButtonToXY(note, cc);
      const button = lodash.get(activePage, `buttons.${x}.${y}`, undefined) as LaunchpadButton;
      if (!button || button.down.length <= 0) return;
      
      const PlayMacro = (actions: Action[], loop: boolean, x: number, y: number, oldId: (string | false) = false) => {
        const id = uniqueId();
        const macro = new MacroRunner(actions, x, y, loop);
        let cancel = false;

        macro.on('onStopButton', (x, y) => {
          cancel = true;
          const ids = [];
          running.forEach(v => {
            if (v.x === x && v.y === y) {
              v.Stop();
              ids.push(v.id);
            }
          })
  
          ids.forEach(id => removeRunner(id));
        })
  
        macro.on('onRestartButton', (id, x, y) => {
          const ids = [];
          running.forEach(v => {
            if ((v.x === x && v.y === y) && (v.id !== id)) {
              v.Stop();
              ids.push(v.id);
            }
          })
  
          ids.forEach(id => removeRunner(id));
        })
  
        macro.on('onStopAll', () => {
          cancel = true;
          PTTCounter.Zero();
          pushToTalk.Release();

          running.forEach(v => v.Stop());
          clearRunner();
        })

        macro.on('onPushToTalkStart', () => {
          pushToTalk.Push();
          PTTCounter.Inc()
        });
        macro.on('onPushToTalkEnd', PTTCounter.Dec);

        macro.on('onFinished', () => {
          //console.log("PTT Actions Left:", PTTCounter.Value())
          if (PTTCounter.Value() <= 0) {
            pushToTalk.Release();
          }

          macro.removeListener('onPushToTalkStart', PTTCounter.Inc)
          macro.removeListener('onPushToTalkEnd', PTTCounter.Dec)
        })

        macro.Run().then(() => {
          removeRunner(id);
        }).catch(() => {
          removeRunner(id);
        });

        addRunner(id, macro);
      }
      PlayMacro(button.down, button.loop, x, y);
    }
    
    const released = (note: number, cc: boolean) => {
      const [ x, y ] = pad.ButtonToXY(note, cc);
      const button = lodash.get(activePage, `buttons.${x}.${y}`) as LaunchpadButton;
      if (!button || button.up.length <= 0) return;
      
      const id = uniqueId();
      const macro = new MacroRunner(button.up, x, y);

      macro.on('onStopButton', (x, y) => {
        const ids = [];
        running.forEach(v => {
          if (v.x === x && v.y === y) {
            v.Stop();
            ids.push(v.id);
          }
        })

        ids.forEach(id => removeRunner(id));
      })

      macro.on('onRestartButton', (id, x, y) => {
        const ids = [];
        running.forEach(v => {
          if ((v.x === x && v.y === y) && (v.id !== id)) {
            v.Stop();
            ids.push(v.id);
          }
        })

        ids.forEach(id => removeRunner(id));
      })

      macro.on('onPushToTalkStart', PTTCounter.Inc);
      macro.on('onPushToTalkEnd', PTTCounter.Dec);

      macro.on('onStopAll', () => {
        running.forEach(v => v.Stop());
        clearRunner();
      })

      macro.Run().then(() => removeRunner(id)).catch(() => removeRunner(id));

      macro.on('onFinished', () => {
        macro.removeListener('onPushToTalkStart', PTTCounter.Inc)
        macro.removeListener('onPushToTalkEnd', PTTCounter.Dec)
      })

      addRunner(id, macro);
    }
    
    emitter.on('onButtonDown', pressed)
    emitter.on('onButtonUp', released)

    return () => {
      ipcRenderer.removeListener(ipcLabels.macros.stopAll, stopAll);
      emitter.removeListener('onButtonDown', pressed)
      emitter.removeListener('onButtonUp', released)
      clearRunner();
    }
  }, [ emitter, pad, activePage ])

  const value = React.useMemo(() => ({
    running,
    stopAll,
    stopSpecific
  }), [ running, stopAll, stopSpecific ])

  return (
    <Provider value={value}>
      {children}
    </Provider>
  )
}

export const MacroContext = {
  Provider: MacroProvider,
  Context: macroContext,
}








