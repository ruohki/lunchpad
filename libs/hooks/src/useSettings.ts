import * as lodash from 'lodash';
import * as React from 'react';
import { SetStateAction, Dispatch } from 'react'

interface CustomEvent extends Event {
  key: string
  value: any
}

export const isClient = typeof window === 'object';

const originalSetItem = localStorage.setItem; 
localStorage.setItem = function(key, value, dispatch = true) {
  const event = new Event('localStoreUpdate') as CustomEvent;

  event.value = value;
  event.key = key;

  if (dispatch) document.dispatchEvent(event);
  originalSetItem.apply(this, arguments);
}

type parserOptions<T> =
  | {
      raw: true;
    }
  | {
      raw: false;
      serializer: (value: T) => string;
      deserializer: (value: string) => T;
    };

const noop = () => {};


export function useLocalStorage<T>(key: string, def: any) {
  // pull the initial value from local storage if it is already set
  const [state, setState] = React.useState<T | null>(() => {
      const exValue = localStorage.getItem(key)
      if (exValue) {
          return JSON.parse(exValue) as T
      }
      return null
  })

  // save the new value when it changes
  React.useEffect(() => {
      localStorage.setItem(key, JSON.stringify(state))
  }, [state])

  // memoize a storage watcher callback back because everything in hooks should be memoized
  const storageWatcher = React.useCallback(
      (e: StorageEvent) => {
          if (e.newValue) {
              // update ours if we
              setState((currState) => {
                  const newDat = JSON.parse(e.newValue || "null")
                  return newDat == state ? newDat : currState
              })
          }
      },
      [state]
  )

  const updated = React.useCallback((e: CustomEvent) => {
    if (key === e.key) {
      setState(JSON.parse(e.value))
    }
  }, [state]);

  // install the watcher
  React.useEffect(() => {
      window.addEventListener("storage", storageWatcher)
      document.addEventListener("localStoreUpdate", updated, false);
      // stop listening on remove
      return () => {
          window.removeEventListener("storage", storageWatcher)
          document.removeEventListener('localStoreUpdate', updated);
      }
  }, [state])

  return [ state, setState ] as const;
}

export const useSettings = (key, defaultValue): [string, (value: any) => void] => {
  //@ts-ignore
  if (lodash.isEmpty(localStorage.getItem(key))) localStorage.setItem(key, defaultValue, false);
  
  const [ value, setValue ] = React.useState(localStorage.getItem(key));
   
  React.useEffect(() => {
    const updated = (e: CustomEvent) => {
      if (key === e.key) {
        setValue(JSON.parse(e.value))
      }
    }

    document.addEventListener("localStoreUpdate", updated, false);

    return () => {
      document.removeEventListener('localStoreUpdate', updated);
    }
  }, [key])

  const set = (value) => {
    localStorage.setItem(key, value)
  }

  return [value, set];
}