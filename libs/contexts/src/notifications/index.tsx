import * as React from 'react';
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

const NotificationProvider = ( { children } ) => {
  const [ notifications, setNotifications ] = React.useState([]);
  
  const removeNotification = React.useCallback((id: string) => {
    setNotifications(notifications => {
      const index = notifications.findIndex((notification) => notification.id === id);
      notifications.splice(index, 1);
      return [...notifications];
    });
  }, []) ;

  const addNotification = React.useCallback((text: string, delay = 10000, severity = Severity.info): string => {
    const id = uuid();

    setNotifications([{
      id,
      text,
      delay,
      severity
    }, ...notifications])

    if (delay > 0) {
      setTimeout(() => removeNotification(id), delay);
    }

    return id;
  }, [ notifications, removeNotification ]);

  const value = React.useMemo(() => ({
    addNotification,
    removeNotification
  }), [addNotification, removeNotification])

  return (
    <Provider value={value}>
      <NotificationContainer>
        <AnimatePresence
          custom
          onExitComplete={() => console.log("Done")}
        >
          {notifications.map(({ id, text, delay, severity}) => (
            <Notification
              id={id}
              severity={severity}
              key={`notification-${id}`}
              initial={{ opacity: 0, y: -50}}
              animate={{ opacity: 1, y: 0}}
              exit={{ opacity: 0, y: 50 }}
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
  const { addNotification, removeNotification } = React.useContext(notificationContext);
  const [ ids, setIds ] = React.useState([]);

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