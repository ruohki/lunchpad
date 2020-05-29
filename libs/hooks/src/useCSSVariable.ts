import { useEffect, useRef } from 'react';

export const useCSSVariable = <T>(name: string, defaultValue: T): [ T, (value: T) => void ] => {
  const setValue = (value: T) => {
    document.documentElement.style.setProperty(`--${name}`, value.toString());
  }
  const value = document.documentElement.style.getPropertyValue(`--${name}`) as unknown as T || defaultValue
  return [ value, setValue ];
}

export const useEssentialCSSVariable = () => {
  const ref = useRef(null);

  const [, setWidth ] = useCSSVariable('width', `${document.documentElement.clientWidth}px`);
  const [, setHeight ] = useCSSVariable('height', `${document.documentElement.clientHeight}px`);

  useEffect(() => {
    const handleResize = () => {
      const width = document.documentElement.clientWidth;
      const height = document.documentElement.clientHeight;
      
      setWidth(`${width > height ? height : width}px`);
      setHeight(`${height > width ? width : height}px`);
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    }; 
  }, [setHeight, setWidth]);
  return ref
}