import { lighten } from 'polished';
import { clamp } from 'lodash';

export const XYToButton = (x, y) => y * 10 + x

export const ButtonToXY = (note) =>{
  return [(note % 10), Math.floor(note / 10)]
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