import React, { useEffect, useState } from 'react';
import { useKey, useMeasure } from 'react-use';
import { AnimatePresence } from "framer-motion";
import _ from 'lodash';
import { Backdrop, ContextMenuContainer  } from './components';

const store = React.createContext<{
  showContextMenu?: (x: number, y: number, component: any) => void
}>({});

const { Provider } = store;

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
 
  const showContextMenu = (x: number, y: number, component: any) => {
    setMenuComponent(component);
    setMouseLocation({ x, y});
    setIsVisible(true)
  };

  return (
    <Provider value={{ showContextMenu }}>
      <AnimatePresence initial={true}>
        {isVisible && (
          <Backdrop
            onClick={(e) => {
              e.stopPropagation();
              hideContextMenu();
            }}
          >
            <ContextMenuContainer
              style={{ left: contextMenuLocation.x, top: contextMenuLocation.y }}
              /* positionTransition */
              initial={{ opacity: 0, scale:  0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0, transition: { duration: 0.1 } }}
            >
              <div ref={ref} />
              {menuComponent}
            </ContextMenuContainer>
          </Backdrop>
        )}
      </AnimatePresence>
      {children}
    </Provider>
  );
};

export { store, ContextMenuProvider }
