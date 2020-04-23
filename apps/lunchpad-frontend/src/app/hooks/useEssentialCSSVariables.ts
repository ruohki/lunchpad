import React, { useEffect } from 'react'
import { useMouse } from 'react-use';
import useCSSVariable from './useCSSVariable';

export default () => {
  const ref = React.useRef(null);
/*   const { docX, docY } = useMouse(ref); */
  
  const [, setWidth ] = useCSSVariable('width', `${document.documentElement.clientWidth}px`);
  const [, setHeight ] = useCSSVariable('height', `${document.documentElement.clientHeight}px`);
  /* const [, setMX ] = useCSSVariable('mx', 0);
  const [, setMY ] = useCSSVariable('my', 0); */

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

/*   useEffect(() => {
    setMX(docX);
    setMY(docY);
  }, [docX, docY, setMX, setMY]); */

  return ref
}