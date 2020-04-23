import React from 'react';

export default <T>(name: string, defaultValue: T): [ T, (value: T) => void ] => {
  const setValue = (value: T) => {
    document.documentElement.style.setProperty(`--${name}`, value.toString());
  }
  const value = document.documentElement.style.getPropertyValue(`--${name}`) as unknown as T || defaultValue
  return [ value, setValue ];
}