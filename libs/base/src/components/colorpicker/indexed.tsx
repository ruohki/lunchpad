import React from "react";

import { CustomPicker } from "react-color";

import { Split, Child } from "../basic/layout";

import { PickerContainer, StyledCircle } from './components';
import { Palettes } from './palettes';

export const IndexPicker = CustomPicker(({ onChangeComplete, ...props}) => (
  <PickerContainer onClick={(e) => e.stopPropagation()}>
    <Split
      direction="row"
      radius="4px"
      content="stretch"
      width="100%"
      height="100%"
    >
      <Child grow height="100%" padding="1rem 1rem 1rem 0.5rem">
        <StyledCircle
          {...props}
          width="100%"
          circleSize={15}
          colors={Palettes.Indexed}
        />
      </Child>
    </Split>
  </PickerContainer>
));