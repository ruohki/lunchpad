import * as lodash from 'lodash';
import { useState, useEffect } from 'react';

interface CustomEvent extends Event {
  key: string
  value: string
}

const originalSetItem = localStorage.setItem; 
localStorage.setItem = function(key, value, dispatch = true) {
  const event = new Event('localStoreUpdate') as CustomEvent;

  event.value = value;
  event.key = key;

  if (dispatch) document.dispatchEvent(event);
  originalSetItem.apply(this, arguments);
}

export const useSettings = (key, defaultValue): [string, (value: any) => void] => {
  //@ts-ignore
  if (lodash.isEmpty(localStorage.getItem(key))) localStorage.setItem(key, defaultValue, false);
  
  const [ value, setValue ] = useState(localStorage.getItem(key));
   
  useEffect(() => {
    const updated = (e: CustomEvent) => {
      if (key === e.key) {
        setValue(e.value)
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