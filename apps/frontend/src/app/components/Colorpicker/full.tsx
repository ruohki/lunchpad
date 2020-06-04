import React from "react";

import { CustomPicker } from "react-color";
import { Saturation, Hue } from "react-color/lib/components/common";

import { Split, Child, Button } from "@lunchpad/base";

import { PickerContainer, SaturationCursor, ColorPickerElementWrapper, HueCursor, StyledCircle } from './components';
import { Full } from './palettes';

import { MenuContext } from '@lunchpad/contexts'
import { useMouseHovered } from 'react-use'

export const FullPillPicker = (props) => {
  const [ color ] = React.useState(props.color);
  const { showContextMenu, closeMenu } = React.useContext(MenuContext.Context);

  const ref = React.useRef(null);
  const mouse = useMouseHovered(ref, { whenHovered: true })

  const Picker = <FullPickerWrapper {...props} />

  return <Button width="100%" height="30px" color={`rgb(${props.color.r},${props.color.g},${props.color.b})`} ref={ref} onClick={() => showContextMenu(mouse.posX, mouse.posY, Picker)}></Button>
}

const FullPickerWrapper = (props) => {
  const [ color, setColor ] = React.useState(props.color);
  const handleChange = c => {
    setColor(c)
    props.onChange(c)
  }
  return <FullPicker color={color} onChange={setColor} onChangeComplete={handleChange} />
}

export const FullPicker = CustomPicker(({onChangeComplete, ...props}) => {

  return (
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
            colors={Full}
          />
        </Child>
      </Split>
    </PickerContainer>
  );
});