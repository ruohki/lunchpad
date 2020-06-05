import range from 'lodash/range';

import { lighten, toColorString } from 'polished';

export const XYToButton = (x, y) => y * 6 + x

export const ButtonToXY = (note) => {
  const y = Math.floor(note / 6)
  const x = note % 6
  return [x,y]
}

export const MakeButtonColor = ({ r, g, b}) => {
  let color = "#f1f1f1";
  
  const luminance = (((0.2126*r) + (0.7152*g) + (0.0722*b)) / 255) || 0.1
  color = `rgb(${r},${g}, ${b})`
  if (luminance <= 0.1) {
    color = lighten((1 / Math.sinh(luminance)) / 50, `rgb(${r},${g}, ${b})`)
  }

  return color;
}