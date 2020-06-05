import range from 'lodash/range';

import { lighten } from 'polished';
import { clamp } from 'lodash';


// 0x68 - 0x70   104 - 112
//00               08
//10               18
//20               28
//30               38
//40               48
//50               58
//60               68
//70               78
//112
export const XYToButton = (x, y) => {
  if (y === 8) return 104 + x
  return (0x70 - (y * 0x10)) + x
}

export const ButtonToXY = (note, cc) => {
  if (cc) return [ note - 104, 8 ] 
  return [(note % 16), 7 - Math.floor((note / 16)) ]
}

export const MakeButtonColor = ({ r, g, b}) => {
  let color = "#f1f1f1";
  
  const luminance = (((0.2126*(r * 4)) + (0.7152*(g * 4)) + (0.0722* (b* 4))) / 255) || 0.1
  color = `rgb(${clamp(r * 4, 255)},${clamp(g * 4, 255)}, ${clamp(b * 4, 255)})`
  if (luminance <= 0.1) {
    color = lighten((1 / Math.sinh(luminance)) / 50, `rgb(${clamp(r * 4, 255)},${clamp(g * 4, 255)}, ${clamp(b * 4, 255)})`)
  }

  return color;
}