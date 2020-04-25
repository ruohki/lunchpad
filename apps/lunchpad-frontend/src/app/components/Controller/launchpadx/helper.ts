import range from 'lodash/range';

import { ButtonConfiguration } from '@lunchpad/types';

export const XYToButton = (x, y) => (y + 1) * 10 + x + 1

export const GetDefaultButtonState = () => {
  const stateMap = new Map<number, ButtonConfiguration>();

  range(0, 9).map((y) => range(0,9).map((x) => stateMap.set(XYToButton(x,y), {
    buttonId: XYToButton(x,y),
    label: `${x}${y} - ${XYToButton(x,y)}`,
    state: 'released',
    spec: [ 0,0,0 ]
  })));
  
  stateMap.delete(99);

  return stateMap;
}