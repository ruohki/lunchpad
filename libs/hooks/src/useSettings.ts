import * as lodash from 'lodash';
import * as React from 'react';

interface CustomEvent extends Event {
  key: string
  value: any
}

const originalSetItem = localStorage.setItem;
localStorage.setItem = function(key, value, dispatch = true) {
  const event = new Event('localStoreUpdate') as CustomEvent;

  event.value = value;
  event.key = key;

  if (dispatch) document.dispatchEvent(event);
  //@ts-ignore
  originalSetItem.apply(this, arguments);
};

export function useLocalStorage<T>(key: string, defaultValue: T | null = null): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [ value, setValue ] = React.useState<T | null>(() => {
    const rawVal = localStorage.getItem(key);
    if (!rawVal) return defaultValue
    if (rawVal?.toLowerCase() === "true") return true
    else if (rawVal?.toLowerCase() === "false") return false
    else {
      try {
        return JSON.parse(rawVal)
      } catch {
        return rawVal
      }
    }
  });

  React.useEffect(() => {
    if ((typeof value === "object") || (Array.isArray(value))) {
      localStorage.setItem(key, JSON.stringify(value));
    } else localStorage.setItem(key, (value as unknown) as string);
  }, [ value ])

  const storageEvent = React.useCallback((e: StorageEvent) => {
    setValue(currValue => {
      if ((typeof e.newValue === "object") || (Array.isArray(e.newValue))) {
        const newDat = JSON.parse(e.newValue);
        return newDat
      } else {
        const newDat = e.newValue as unknown as T;
        return newDat
      }
    })
  }, [ value ])

  const customEvent = React.useCallback((e: CustomEvent) => {
    if (e.key === key) {
      setValue(currValue => {
        if ((typeof e.value === "object") || (Array.isArray(e.value))) {
          const newDat = JSON.parse(e.value);
          return newDat
        } else {
          const newDat = e.value as unknown as T;
          return newDat
        }
      })
    }
  }, [ value ])

  React.useEffect(() => {
    window.addEventListener('storage', storageEvent);
    //@ts-ignore
    document.addEventListener('localStoreUpdate', customEvent);
    // stop listening on remove
    return () => {
      window.removeEventListener('storage', storageEvent);
      //@ts-ignore
      document.removeEventListener('localStoreUpdate', customEvent);
    };
  }, [value]);

  return [value, setValue];
}




export const useSettings = useLocalStorage /* (
  key,
  defaultValue
): [string, (value: any) => void] => {
  //@ts-ignore
  if (lodash.isEmpty(localStorage.getItem(key)))
    localStorage.setItem(key, defaultValue, false);

  const [value, setValue] = React.useState(localStorage.getItem(key));

  React.useEffect(() => {
    const updated = (e: CustomEvent) => {
      if (key === e.key) {
        setValue(JSON.parse(e.value));
      }
    };

    document.addEventListener('localStoreUpdate', updated, false);

    return () => {
      document.removeEventListener('localStoreUpdate', updated);
    };
  }, [key]);

  const set = value => {
    localStorage.setItem(key, value);
  };

  return [value, set];
};
 */