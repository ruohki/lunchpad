import React, { useEffect, useState } from 'react';
import { useKey, useMeasure, useLocation } from 'react-use';
import { AnimatePresence } from "framer-motion";
import { Backdrop, ContextMenuContainer  } from './components';

export interface IContextMenuContext {
  showContextMenu(x: number, y: number, component: JSX.Element): void
  closeMenu(event: React.MouseEvent<HTMLDivElement, MouseEvent>): void
}
const contextMenuContext = React.createContext<Partial<IContextMenuContext>>({});

const { Provider } = contextMenuContext;

const ContextMenuProvider = ({ children }) => {
  const [ mouseLocation, setMouseLocation ] = useState<{x: number, y: number}>({ x: 0, y: 0});
  const [ contextMenuLocation, setContextMenuLocation ] = useState<{x: number, y: number}>({ x: 0, y: 0});
  const [ menuComponent, setMenuComponent ] = useState(<div />)
  const [ isVisible, setIsVisible ] = useState(false)
  const hideContextMenu = () => setIsVisible(false);
  
  const [ref, { width, height }] = useMeasure();
  
  useKey('Escape', hideContextMenu);
  
  useEffect(() => {
    const cHeight = document.documentElement.clientHeight;
    const cWidth = document.documentElement.clientWidth;

    const x = mouseLocation.x + width > cWidth ? cWidth - width : mouseLocation.x
    const y = mouseLocation.y + height > cHeight ? cHeight - height : mouseLocation.y

    setContextMenuLocation({ x, y })

  }, [width, height, mouseLocation ])
 
  const showContextMenu = (x: number, y: number, component: JSX.Element) => {
    setMenuComponent(component);
    setMouseLocation({ x, y});
    setIsVisible(true)
  };

  const closeMenu = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    event.stopPropagation();
    hideContextMenu();
  }

  return (
    <Provider value={{ showContextMenu, closeMenu }}>
      <AnimatePresence initial={true}>
        {isVisible && (
          <Backdrop
            key="backdrop"
            onClick={closeMenu}
            onContextMenu={closeMenu}
          >
            <ContextMenuContainer
              key="menu"
              onContextMenu={(e) => e.stopPropagation()}
              style={{ left: contextMenuLocation.x, top: contextMenuLocation.y }}
              /* positionTransition */
              initial={{ opacity: 0, scale:  0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0, transition: { duration: 0.1 } }}
            >
              <div ref={ref}>
                {menuComponent}
              </div>
            </ContextMenuContainer>
          </Backdrop>
        )}
      </AnimatePresence>
      {children}
    </Provider>
  );
};

export const MenuContext = { 
  Context: contextMenuContext,
  Provider: ContextMenuProvider
}
