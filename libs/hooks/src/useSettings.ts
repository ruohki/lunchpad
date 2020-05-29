
import { useState, useEffect } from 'react';

interface CustomEvent extends Event {
  key: string
  value: string
}

const originalSetItem = localStorage.setItem; 
localStorage.setItem = function(key, value) {
  const event = new Event('localStoreUpdate') as CustomEvent;

  event.value = value;
  event.key = key;

  document.dispatchEvent(event);
  originalSetItem.apply(this, arguments);
}

export const useSettings = (key, defaultValue) => {
  const [ value, setValue ] = useState(localStorage.getItem(key) ?? defaultValue);
   
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