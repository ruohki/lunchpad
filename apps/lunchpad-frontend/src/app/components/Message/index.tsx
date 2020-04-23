import React, { useEffect, useRef, useState, useContext } from 'react';
import { Notification, NotificationContainer, Severity } from './components'
import { AnimatePresence } from "framer-motion";
import { v4 as uuid } from 'uuid';
import _ from 'lodash';

const store = React.createContext<{
  addNotification: (text: string, delay?: number, severity?: Severity) => string,
  removeNotification: (id: string) => void
}>({
  addNotification: () => "",
  removeNotification: () => null
});

const { Provider } = store;


function useTimeout(callback, delay) {
  const savedCallback = useRef()

  // Remember the latest callback.
  useEffect(
    () => {
      savedCallback.current = callback
    },
    [callback]
  )

  // Set up the interval.
  useEffect(
    () => {
      function tick() {
        if (savedCallback) {
          //@ts-ignore
          savedCallback.current()
        }
      }
      if (delay !== null) {
        const id = setTimeout(tick, delay)
        return () => clearTimeout(id)
      }
    },
    [delay]
  )
}

const Selfdestroy = ({ interval, onDestroy }) => {
  useTimeout(() => {
    onDestroy();
  }, interval);
  return (
    <div />
  );
};

const NotificationProvider = ( { children } ) => {
  const [ state, setState ] = useState([]);
  
  const addNotification = (text: string, delay = 10000, severity = Severity.info): string => {
    const id = uuid();

    setState([{
      id,
      text,
      delay,
      severity
    }, ...state])

    return id;
  }

  const removeNotification = (id: string) => {
    setState(_.filter(state, (m) => m.id !== id))
  }

  return (
    <Provider value={{ addNotification, removeNotification }}>
      <NotificationContainer>
        <AnimatePresence initial={true}>
          {state.map(({ id, text, delay, severity}) => (
            <Notification 
              severity={severity}
              key={`notification-${id}`}
              positionTransition
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50, transition: { duration: 0.2, delay: 0.1 } }}
            >
              {delay > 0 && <Selfdestroy
                interval={delay}
                onDestroy={() => setState(_.filter(state, (m) => m.id !== id))}
              />}
              {text}
            </Notification>
          ))}
        </AnimatePresence>
      </NotificationContainer>
      {children}
    </Provider>
  );
};

export const useNotification = (): [(text: string, delay?: number, severity?: Severity) => void, () => void] => {
  const { addNotification, removeNotification } = useContext(store);
  const [ids, setIds] = useState([]);

  const show = (text: string, delay = 10000, severity: Severity = Severity.info) => {
    if (ids.length > 0 && delay === 0) return;
    setIds([...ids, addNotification(text, delay, severity)])
  }

  const remove = () => {
    if (ids.length <= 0) return;
    const [id, ...rest] = ids;
    removeNotification(id);
    setIds(rest);
  }
  
  return [
    show,
    remove
  ]
}

export { store, NotificationProvider }
