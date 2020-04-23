
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../../../../types/window.require.d.ts" />

import React, { useState, useEffect } from 'react';

const { remote } = window.require('electron')

const settings = remote.getGlobal('settings');

export const useSettings = (key) => {
  const [ value, setValue ] = useState(settings.get(key));
   
  useEffect(() => {
    const observer = settings.watch(key, setValue);

    return () => {
      observer.dispose();
    }
  }, [key])

  const set = (value) => {
    settings.set(key, value)
  }

  return [value, set];
}