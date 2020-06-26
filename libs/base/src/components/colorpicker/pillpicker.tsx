import * as React from 'react';

import { Button } from "../basic/button";
import { FullPicker } from './fullcolor';
import { IndexPicker } from './indexed';
import { LegacyPicker } from './legacy';

import { useMouseHovered } from 'react-use'

interface ReactColor {
  hex: string,
  rgb: { r: number, g: number, b: number, a?: number}
  hsl: { h: number, s: number, l: number, a?: number}
}

interface IPillPicker {
  showContextMenu: (x: number, y: number, component: JSX.Element, width?: number, height?: number) => void
  onChange: (color: ReactColor) => void
  color: string
}

export const FullPillPicker: React.SFC<IPillPicker> = (props) => {

  const ref = React.useRef(null);
  const mouse = useMouseHovered(ref, { whenHovered: true })

  const Picker = <FullPickerWrapper {...props} />

  return (
    <Button 
      width="100%"
      height="30px"
      color={props.color}
      ref={ref}
      onClick={() => props.showContextMenu(mouse.posX, mouse.posY, Picker, 420, 246)}
    />
  )
}

const FullPickerWrapper = (props) => {
  const [ color, setColor ] = React.useState(props.color);
  const handleChange = c => {
    setColor(c)
    props.onChange(c)
  }
  return <FullPicker color={color} onChange={setColor} onChangeComplete={handleChange} />
}

export const IndexPillPicker: React.SFC<IPillPicker> = (props) => {
  const ref = React.useRef(null);
  const mouse = useMouseHovered(ref, { whenHovered: true })

  const Picker = <IndexPickerWrapper {...props} />

  return <Button width="100%" height="30px" color={props.color} ref={ref} onClick={() => props.showContextMenu(mouse.posX, mouse.posY, Picker, 420, 246)}></Button>
}

const IndexPickerWrapper = (props) => {
  const [ color, setColor ] = React.useState(props.color);
  const handleChange = c => {
    setColor(c)
    props.onChange(c)
  }
  return <IndexPicker color={color} onChange={setColor} onChangeComplete={handleChange} />
}

export const LegacyPillPicker: React.SFC<IPillPicker> = (props) => {
  const ref = React.useRef(null);
  const mouse = useMouseHovered(ref, { whenHovered: true })

  const Picker = <LegacyPickerWrapper {...props} />

  return <Button width="100%" height="30px" color={props.color} ref={ref} onClick={() => props.showContextMenu(mouse.posX, mouse.posY, Picker, 420, 246)}></Button>
}

const LegacyPickerWrapper = (props) => {
  const [ color, setColor ] = React.useState(props.color);
  const handleChange = c => {
    setColor(c)
    props.onChange(c)
  }
  return <LegacyPicker color={color} onChange={setColor} onChangeComplete={handleChange} />
}