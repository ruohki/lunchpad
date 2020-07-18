import * as React from 'react';
import set from 'lodash/setWith';
import lodash from 'lodash';
import { v4 as uuid } from 'uuid';


import { useSettings } from '@lunchpad/hooks';
import { Page, LaunchpadButton } from './classes';
import { settingsLabels } from '@lunchpad/types';
import { JsonProperty, Serializable, deserialize, serialize } from 'typescript-json-serializer';

@Serializable()
class Layout {
  @JsonProperty()
  public pages: Array<Page>

  constructor(pages: Array<Page>) { 
    this.pages = pages;
  }
}


export interface ILayoutContext {
  activePage: Page
  pages: Page[]

  setActivePage(name: string): void

  addPage(name: string): void
  pastePage(page: Page, id?: string): void
  removePage(id: string): void
  renamePage(id: string, name: string): boolean

  setButton(button: LaunchpadButton, x: number, y: number, pageId: string): void
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

const canParse = (json: string): boolean => {
  try {
    JSON.parse(json)
    return true;
  } catch {
    return false;
  }
}



const LayoutProvider = ({ children }) => {
  const raw: Array<Page> = localStorage.getItem(settingsLabels.layout.config) ? JSON.parse(localStorage.getItem(settingsLabels.layout.config)): [ defaultPage ];
  const configLayout = raw.map(el => deserialize<Page>(el,Page));
  
  const [ layout, _setLayout ] = React.useState<Array<Page>>(configLayout)
  const [ activePageID, setActivePageID ] = useSettings(settingsLabels.layout.active, "default")
  
  const idx = layout.findIndex(p => p.id === activePageID)
  const [ activePage, _setActivePage ] = React.useState<Page>(layout[idx]);
  

  const updateLayout = (l) => {
    localStorage.setItem(settingsLabels.layout.old, localStorage.getItem(settingsLabels.layout.config))
    console.log(l)
    localStorage.setItem(settingsLabels.layout.config, JSON.stringify(l))
    const idx = l.findIndex(p => p.id === activePageID)
    const pages = [...l]
    _setLayout(pages);
    _setActivePage(pages[idx]);


    /* localStorage.setItem(settingsLabels.layout.old, localStorage.getItem(settingsLabels.layout.config))
    localStorage.setItem(settingsLabels.layout.config, `[${pa}]`)
    const idx = l.findIndex(p => p.id === activePageID)
    const pages = [...l]
    _setLayout(pages);
    _setActivePage(pages[idx]); */
  }
  
  const setLayout = (id: string, page: Page) => {
    updateLayout([...layout.map(p => p.id === id ? page : p)]);
  }

  const setActivePage = (id: string) => {
    const idx = layout.findIndex(p => p.id === id)
    if (idx === -1) return;
    setActivePageID(id);
    _setActivePage(layout[idx]);
  }
  
  const addPage = (name: string) => {
    const id = uuid();
    updateLayout([...layout, new Page(name, id)]);
  }

  const pastePage = (page: Page, id: string = "") => {
    if (lodash.isEmpty(id)) {
      const id = uuid();
      const newPage = new Page(page.name, id);
      newPage.buttons = page.buttons;
      updateLayout([...layout, newPage]);
    } else {
      updateLayout([...layout.map(p => p.id === page.id ? page : p)]);

    }
  }

  const removePage = (id: string) => {
    const idx = layout.findIndex(p => p.id === id)
    if (id === "default" || idx === -1 ) return;
    
    if (layout[idx].id === activePage.id) {
      setActivePage("default");
    }
    updateLayout(layout.filter(p => p.id !== id));
  }
  
  const renamePage = (id: string, name: string) => {
    const idx = layout.findIndex(p => p.id === id)
    if (id === "default" || name === "" || idx === -1 ) return false;
    layout[idx].name = name;
    updateLayout([...layout]);
    return true
  }

  const setButton = (button: LaunchpadButton, x: number, y: number, pageId: string) => {
    const idx = layout.findIndex(p => p.id === pageId)
    if (idx === -1 ) return false;
    
    set(layout[idx], `buttons.${x}.${y}`, button, Object)

    setLayout(pageId, layout[idx]);
    if (pageId === activePage.id) _setActivePage(layout[idx]);
  }
  

  const clearButton = (x: number, y: number,  pageId: string) => {
    const idx = layout.findIndex(p => p.id === pageId)
    if (idx === -1 || !lodash.get(layout[idx], `buttons.${x}.${y}`, undefined)) return false;

    delete(layout[idx].buttons[x][y])
    setLayout(pageId, layout[idx]);
    if (pageId === activePage.id) _setActivePage(layout[idx]);
  }

  React.useEffect(() => {
    const idx = layout.findIndex(p => p.id === activePageID)
    if (activePageID !== activePage.id) setActivePage(activePageID)
    else if (idx === -1) setActivePageID(activePage.id)
  }, [ activePageID ])
 
  const swapButtons = (pageId: string, xA: number, yA: number, xB: number, yB: number) => {
    const idx = layout.findIndex(p => p.id === activePageID)
    if (idx === -1) return;
    if (!lodash.get(layout[idx], `buttons.${xA}.${yA}`, undefined) && !lodash.get(layout[idx], `buttons.${xB}.${yB}`, undefined)) return;
    
    const page = layout[idx];
    const buttonA = page[xA][yA];
    const buttonB = page[xB][yB];

    if (!buttonA || !buttonB) {
      if (!buttonA) {
        set(page.buttons, `${xA}.${yA}`, buttonB)
        delete page.buttons[xB][yB];
      } else {
        set(page.buttons, `${xB}.${yB}`, buttonA)
        delete page.buttons[xA][yA];
      }

    } else {
      set(page.buttons, `${xA}.${yA}`, buttonB)
      set(page.buttons, `${xB}.${yB}`, buttonA)
    }
    
    page.buttons = {...page.buttons}
    return updateLayout([...layout.filter(p => p.id === page.id ? page : p)]);
  }

  return (
    <Provider value={{
      activePage,
      pages: Array.from(layout.values()),
      setActivePage,
      
      addPage,
      pastePage,
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
  Page,
  Context: layoutContext,
  Provider: LayoutProvider
}
