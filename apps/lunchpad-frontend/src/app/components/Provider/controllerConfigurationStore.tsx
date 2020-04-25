// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../../../../../types/window.require.d.ts" />

import React, { useState, useEffect } from 'react';
import { ipcChannels as ipc, ControllerConfigurationStoreProps, ButtonConfiguration } from '@lunchpad/types';

import { GetDefaultButtonState } from '../Controller/launchpadmk2/helper';

const { ipcRenderer } = window.require('electron');


const getDef = () => {
  const mapA = new Map<string, Map<number, ButtonConfiguration>>();
  mapA.set("default", GetDefaultButtonState())
  return mapA;
}

const initialStore: ControllerConfigurationStoreProps = {
  controllerType: 'Novation Launchpad',
  controllerModel: 'Launchpad MK2',
  activePage: "default",
  pages: getDef(),
  buttons: GetDefaultButtonState()
}

export const store = React.createContext(initialStore);

const { Provider } = store;

const ControllerConfigurationProvider = ({ children }) => {
  const [ controllerState, setControllerState ] = useState({
    controllerType: initialStore.controllerType,
    controllerModel: initialStore.controllerModel,
  });

  const [ activePage, setActivePage ] = useState(initialStore.activePage ?? "default");
  const [ pages, setPages ] = useState(initialStore.pages);
  const [ buttons , setButtons ] = useState(initialStore.buttons);
  
  useEffect(() => {
    const updateButtonState = (event, pressedButtons: number[]) => {
      const newButtons = new Map<number, ButtonConfiguration>();

      for(const btn of buttons.values()) {
        if (pressedButtons.indexOf(btn.buttonId) !== -1) {
          newButtons.set(btn.buttonId, Object.assign<any, ButtonConfiguration, ButtonConfiguration>({},
            buttons.get(btn.buttonId),
            { state: 'pressed'}
          ))
        } else {
          if (btn.state === 'pressed') {
            newButtons.set(btn.buttonId, Object.assign<any, ButtonConfiguration, ButtonConfiguration>({},
              buttons.get(btn.buttonId),
              { state: 'released'}
            ))
          } else {
            newButtons.set(btn.buttonId, buttons.get(btn.buttonId));
          }
        }
      }
      
      setButtons(newButtons);
    };
    
    ipcRenderer.on(ipc.onButtonStateUpdate, updateButtonState)
    return () => {
      ipcRenderer.removeListener(ipc.onButtonStateUpdate, updateButtonState)
    }
  })

  const updateButton = (pageId: string, id: number, config: ButtonConfiguration) => {
    const newPages = new Map(pages);
    const page = pages.get(activePage)
    const button = page.get(id);

    delete(config.buttonId)
    page.set(id, Object.assign({}, button, config))
    newPages.set(pageId, page);
    
    setPages(newPages);
  }

  const createPage = (name: string) => {
    const newPages = new Map(pages);
    if (pages.has(name)) return false;
    newPages.set(name, GetDefaultButtonState());
    setPages(newPages);
    return true;
  }

  const deletePage = (name: string) => {
    const newPages = new Map(pages);
    if (!pages.has(name)) return false;
    newPages.delete(name);
    setPages(newPages);
    return true;
  }

  const activatePage = (name: string) => {
    if (activePage === name) return false;
    if (!pages.has(name)) return false;
    setActivePage(name);
    const page = pages.get(name);

    const specs = Array.from(page).map(([ id, conf ]) => {
      return [id, conf.spec]
    })
    
    ipcRenderer.send(ipc.onSetManyColors, specs);
    return true;
  }

  const providerStore: ControllerConfigurationStoreProps = {
    ...controllerState,

    buttons,
    updateButton,

    activePage,
    pages,
    createPage,
    deletePage,
    activatePage
  }

  return (
    <Provider value={providerStore}>
      {children}
    </Provider>
  )
}
export default ControllerConfigurationProvider;