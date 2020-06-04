import range from 'lodash/range';

import { lighten } from 'polished';
import { clamp } from 'lodash';

export const XYToButton = (x, y) => {
  return (y + 1) * 10 + x + 1
}

export const ButtonToXY = (note) => [(note % 10) - 1, Math.floor(note / 10) - 1] 

// WTF!?
export const MakeButtonColor = ({ r, g, b}) => {
  let color = "#f1f1f1";
  
  const luminance = (((0.2126*(r)) + (0.7152*(g)) + (0.0722* (b))) / 255) || 0.1
  color = `rgb(${r},${g}, ${b})`
  if (luminance <= 0.1) {
    color = lighten((1 / Math.sinh(luminance)) / 50, `rgb(${r},${g}, ${b})`)
  }

  return color;
}