import * as React from 'react';

export const useTimeout = (callback, delay) => {
  if (delay === 0) return;
  
  const savedCallback = React.useRef()

  // Remember the latest callback.
  React.useEffect(
    () => {
      savedCallback.current = callback
    },
    [callback]
  )

  // Set up the interval.
  React.useEffect(
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