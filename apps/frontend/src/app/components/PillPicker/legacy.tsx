import React from "react";

import { Button, LegacyPicker } from "@lunchpad/base";

import { MenuContext } from '@lunchpad/contexts'
import { useMouseHovered } from 'react-use'

export const IndexPillPicker = (props) => {
  const { showContextMenu } = React.useContext(MenuContext.Context);

  const ref = React.useRef(null);
  const mouse = useMouseHovered(ref, { whenHovered: true })

  const Picker = <LegacyPickerWrapper {...props} />

  return <Button width="100%" height="30px" color={props.color} ref={ref} onClick={() => showContextMenu(mouse.posX, mouse.posY, Picker, 420, 246)}></Button>
}

const LegacyPickerWrapper = (props) => {
  const [ color, setColor ] = React.useState(props.color);
  const handleChange = c => {
    setColor(c)
    props.onChange(c)
  }
  return <LegacyPicker color={color} onChange={setColor} onChangeComplete={handleChange} />
}