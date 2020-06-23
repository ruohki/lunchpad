import React from "react";

import { CustomPicker } from "react-color";

import { Split, Child, Button } from "@lunchpad/base";

import { PickerContainer, StyledCircle } from './components';
import { RGBIndexPalette } from './palettes';

import { MenuContext } from '@lunchpad/contexts'
import { useMouseHovered } from 'react-use'

export const RGBIndexPillPicker = (props) => {
  const { showContextMenu, closeMenu } = React.useContext(MenuContext.Context);

  const ref = React.useRef(null);
  const mouse = useMouseHovered(ref, { whenHovered: true })

  const Picker = <RGBIndexPickerWrapper {...props} />

  return <Button width="100%" height="30px" color={props.color} ref={ref} onClick={() => showContextMenu(mouse.posX, mouse.posY, Picker, 420, 246)}></Button>
}

const RGBIndexPickerWrapper = (props) => {
  const [ color, setColor ] = React.useState(props.color);
  const handleChange = c => {
    setColor(c)
    props.onChange(c)
  }
  return <RGBIndexPicker color={color} onChange={setColor} onChangeComplete={handleChange} />
}

export const RGBIndexPicker = CustomPicker(props => {

  return (
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
            colors={RGBIndexPalette}
          />
        </Child>
      </Split>
    </PickerContainer>
  );
});