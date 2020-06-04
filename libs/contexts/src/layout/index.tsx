import * as React from 'react';
import set from 'lodash/setWith';

import { v4 as uuid } from 'uuid';


import { Page, Button, settingsLabels } from '@lunchpad/types';
import { useSettings } from '@lunchpad/hooks';


export interface ILayoutContext {
  activePage: Page
  pages: Page[]

  setActivePage(name: string): void

  addPage(name: string): void
  removePage(id: string): void
  renamePage(id: string, name: string): boolean

  setButton(button: Button, x: number, y: number, pageId: string): void
  clearButton(x: number, y: number, pageId: string): void
  swapButtons(pageId: string, xA: number, yA: number, xB: number, yB: number): void
}

const layoutContext = React.createContext<Partial<ILayoutContext>>({});
const { Provider } = layoutContext;

const defaultPage = {
  name: "default",
  id: "default",
  buttons: {}
}

const LayoutProvider = ({ children }) => {
  const configLayout = new Map<string, Page>(localStorage.getItem(settingsLabels.layout.config) ? JSON.parse(localStorage.getItem(settingsLabels.layout.config)): [[ "default", defaultPage ]]);
  const [ layout, _setLayout ] = React.useState<Map<string, Page>>(new Map<string, Page>(configLayout))
  const [ activePageID, setActivePageID ] = useSettings(settingsLabels.layout.active, "default")
  const [ activePage, _setActivePage ] = React.useState<Page>(layout.get(activePageID));

  const updateLayout = (l) => {
    localStorage.setItem(settingsLabels.layout.config, JSON.stringify(Array.from(layout.entries())))
    _setLayout(new Map(l));
  }
  
  const setLayout = (key: string, page: Page) => {
    layout.set(key, page);
    updateLayout(new Map(layout));
  }

  const setActivePage = (id: string) => {
    if (!layout.has(id)) return;
    setActivePageID(id);
    _setActivePage(layout.get(id));
  }
  
  const addPage = (name: string) => {
    const id = uuid();
    layout.set(id, new Page(name, id))
    updateLayout(new Map(layout));
  }

  const removePage = (id: string) => {
    if (!layout.has(id)) return false;
    if (id === "default") return;
    
    if (layout.get(id).name === activePage.name) {
      setActivePage("default");
    }

    layout.delete(id);
    updateLayout(new Map(layout));
  }
  
  const renamePage = (id: string, name: string) => {
    if (!layout.has(id)) return false;
    if (name === "") return false;
    const page = layout.get(id);
    page.name = name;
    layout.set(id, page)
    updateLayout(new Map(layout));
    return true
  }

  const setButton = (button: Button, x: number, y: number, pageId: string) => {
    if (!layout.has(pageId)) return;
    const page = layout.get(pageId);
    button.x = x;
    button.y = y;

    set(page.buttons, `[${x}][${y}]`, button, Object)

    setLayout(pageId, page);
    if (pageId === activePage.id) _setActivePage(page);
  }
  

  const clearButton = (x: number, y: number,  pageId: string) => {
    if (!layout.get(pageId) || !(layout.get(pageId).buttons[x][y])) return;
    const page = layout.get(pageId);
    delete page.buttons[x][y]
    setLayout(pageId, page);
    if (pageId === activePage.id) _setActivePage(page);
  }

  React.useEffect(() => {
    const oldPageID = activePage.id;
    if (activePageID !== activePage.id) setActivePage(activePageID)
    else if (!layout.has(activePageID)) setActivePageID(activePage.id)
  }, [ activePageID ])
 /*  const swapButtons = (xA: number, yA: number, pageIdA: string, xB: number, yB: number, pageIdB: string) => {
    if (!layout.has(pageNameA) || !layout.has(pageNameB)) return;
    if (!layout.get(pageNameA)[xA][yA] && !layout.get(pageNameB)[xB][yB]) return;
    
    const pageA = layout.get(pageNameA)
    const pageB = layout.get(pageNameB)
    const buttonA = layout.get(pageNameA)[xA][yA]
    const buttonB = layout.get(pageNameA)[xB][yB]

    if (!buttonA || !buttonB) {
      if (!buttonA) {
        set(pageA.buttons, `${xA}.${yA}`, buttonB)
        pageA.buttons[xA][yA].x = xA;
        pageA.buttons[xA][yA].y = yA;
        delete pageB.buttons[xB][yB];
      } else {
        set(pageB.buttons, `${xB}.${yB}`, buttonA)
        pageA.buttons[xB][yB].x = xB;
        pageA.buttons[xB][yB].y = yB;
        delete pageA.buttons[xA][yA];
      }

    } else {
      set(pageA.buttons, `${xA}.${yA}`, buttonB)
      set(pageB.buttons, `${xB}.${yB}`, buttonA)
    }
    layout.set(pageNameA, pageA)
    layout.set(pageNameB, pageB)

    return updateLayout(new Map(layout));
  } */
  const swapButtons = (pageId: string, xA: number, yA: number, xB: number, yB: number) => {
    if (!layout.has(pageId)) return;
    if (!layout.get(pageId)[xA][yA] && !layout.get(pageId)[xB][yB]) return;
    
    const page = layout.get(pageId);
    const buttonA = page[xA][yA];
    const buttonB = page[xB][yB];

    if (!buttonA || !buttonB) {
      if (!buttonA) {
        set(page.buttons, `${xA}.${yA}`, buttonB)
        page.buttons[xA][yA].x = xA;
        page.buttons[xA][yA].y = yA;
        delete page.buttons[xB][yB];
      } else {
        set(page.buttons, `${xB}.${yB}`, buttonA)
        page.buttons[xB][yB].x = xB;
        page.buttons[xB][yB].y = yB;
        delete page.buttons[xA][yA];
      }

    } else {
      set(page.buttons, `${xA}.${yA}`, buttonB)
      set(page.buttons, `${xB}.${yB}`, buttonA)
    }
    layout.set(pageId, page)

    return updateLayout(new Map(layout));
  }

  return (
    <Provider value={{
      activePage,
      pages: Array.from(layout.values()),
      setActivePage,
      
      addPage,
      removePage,
      renamePage,

      setButton,
      clearButton,
      swapButtons
    }}>

      {children}
    </Provider>
  );
};

export const LayoutContext = {
  Button,
  Page,
  Context: layoutContext,
  Provider: LayoutProvider
}
