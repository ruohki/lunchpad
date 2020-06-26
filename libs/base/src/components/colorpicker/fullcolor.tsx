import * as React from "react";

import { CustomPicker } from "react-color";
import { Saturation, Hue } from "react-color/lib/components/common";

import { Palettes } from './palettes';
import { PickerContainer, ColorPickerElementWrapper, SaturationCursor, HueCursor, StyledCircle } from "./components";

import { Split, Child } from '../basic/layout';

export const FullPicker = CustomPicker(({ onChangeComplete, ...props}) => (
  <PickerContainer onClick={(e) => e.stopPropagation()}>
    <Split
      direction="row"
      radius="4px"
      content="stretch"
      width="100%"
      height="100%"
    >
      <Child height="100%" padding="1rem 0.5rem 1rem 1rem" grow>
        <Split width="100%" height="100%">
          <Child basis="calc(200px - 1rem)">
            <ColorPickerElementWrapper>
              <Saturation {...props} pointer={SaturationCursor} />
            </ColorPickerElementWrapper>
          </Child>
          <Child basis="1.9rem" padding="0.5rem 0 0 0">
            <ColorPickerElementWrapper>
              <Hue {...props} pointer={HueCursor} />
            </ColorPickerElementWrapper>
          </Child>
        </Split>
      </Child>
      <Child grow height="100%" padding="1rem 1rem 1rem 0.5rem">
        <StyledCircle
          {...props}
          width="100%"
          circleSize={18}
          colors={Palettes.RGBCirclesFull}
        />
      </Child>
    </Split>
  </PickerContainer>
));
