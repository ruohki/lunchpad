import range from 'lodash/range';

import { ButtonConfiguration } from '@lunchpad/types';
import { lighten } from 'polished';
import { clamp } from 'lodash';

export const XYToButton = (x, y) => {
  if (y < 8 ) {
    return (y + 1) * 10 + x + 1
  } else return 104 + x
}

export const ButtonToXY = (note) => note < 104 ? [(note % 10) - 1, Math.floor(note / 10) - 1] : [note - 104, 8 ]

export const GetDefaultButtonState = () => {
  const stateMap = new Map<number, ButtonConfiguration>();

  range(0, 9).map((y) => range(0,9).map((x) => stateMap.set(XYToButton(x,y), {
    buttonId: XYToButton(x,y),
    label: `${x}${y} - ${XYToButton(x,y)}`,
    state: 'released',
    spec: [ 0,0,0 ]
  })));
  
  //stateMap.delete(99);

  return stateMap;
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