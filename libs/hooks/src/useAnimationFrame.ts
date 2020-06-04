import * as React from 'react';

export const useAnimationFrame = callback => {
  const requestRef = React.useRef<number>();
  const previousTimeRef = React.useRef<number>();

  React.useEffect(() => {
    const animate = time => {
      if (previousTimeRef.current !== undefined) {
        const deltaTime = time - previousTimeRef.current;
        callback(deltaTime);
      }
      previousTimeRef.current = time;
      requestRef.current = requestAnimationFrame(animate);
    };
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  });
};