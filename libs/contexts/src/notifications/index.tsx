import React, { useEffect, useRef, useState, useContext } from 'react';
import { Notification, NotificationContainer, Severity } from './components'
import { AnimatePresence } from "framer-motion";
import { v4 as uuid } from 'uuid';
import _ from 'lodash';

export interface INotificationContext {
  addNotification: (text: string, delay?: number, severity?: Severity) => string,
  removeNotification: (id: string) => void
  useNotification(): [(text: string, delay?: number, severity?: Severity) => void, () => void]
}

const notificationContext = React.createContext<Partial<INotificationContext>>({});
const { Provider } = notificationContext;

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
  const [ time ] = React.useState(Date.now());
  const [ destroying, setDestroying ] = React.useState(false);

  React.useEffect(() => {
    
    const handle = setInterval(() => {
      if (time + interval <= Date.now()) {
        if (!destroying) {
          setDestroying(true);
          onDestroy();
        }
      }
    })
  }, [ time, interval, destroying ])

  /* useTimeout(() => {
    onDestroy();
  }, interval); */
  return (
    <div />
  );
};

const NotificationProvider = ( { children } ) => {
  const [ state, setState ] = useState([]);
  
  const addNotification = (text: string, delay = 10000, severity = Severity.info): string => {
    return;
    const id = uuid();
    console.log(state.length)
    setState([{
      id,
      text,
      delay,
      severity
    }, ...state])

    return id;
  }

  const removeNotification = (id: string) => {
    console.log(id)
    setState(_.filter(state, (m) => m.id !== id))
  }

  return (
    <Provider value={{
      addNotification,
      removeNotification
    }}>
      <NotificationContainer>
        <AnimatePresence>
          {state.map(({ id, text, delay, severity}) => (
            <Notification
              id={id}
              severity={severity}
              key={`notification-${id}`}
              positionTransition
              initial={{ opacity: 0, y: -50}}
              animate={{ opacity: 1, y: 0}}
              exit={{ opacity: 0, y: 50 }}
              delay={delay}
              onDestroy={removeNotification}
            >
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
  const { addNotification, removeNotification } = useContext(notificationContext);
  const [ ids, setIds ] = useState([]);

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


export const NotificationContext = {
  Provider: NotificationProvider,
  Context: notificationContext,
  useNotification
}

export * from './components'