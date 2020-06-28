import * as React from 'react'

import { Split, Select, Child, Divider, Row } from '@lunchpad/base';

import { LaunchpadButtonLookTextComponent, LaunchpadButtonLookImageComponent, LaunchpadButtonSolidColorComponent, LaunchpadButtonFlashingColorComponent, LaunchpadButtonPulsingColorComponent, LaunchpadButtonRGBColorComponent, LaunchpadButtonLegacyColorComponent } from './partials';

import { MenuContext } from '@lunchpad/contexts';
import { LaunchpadButtonLook, LaunchpadButtonColor, LaunchpadRGBButtonColor, LaunchpadButtonLookType, LaunchpadButtonLookImage, LaunchpadButtonLookText, LaunchpadButtonColorMode, LaunchpadSolidButtonColor, LaunchpadFlashingButtonColor, LaunchpadPulsingButtonColor } from '../../contexts/layout/classes';

interface IAppearance {
  limitedColor: boolean
  look: LaunchpadButtonLook
  baseColor: LaunchpadButtonColor
  activeColor: LaunchpadButtonColor
  onChangeLook(look: LaunchpadButtonLook): void
  onChangeBaseColor(look: LaunchpadButtonColor): void
  onChangeActiveColor(look: LaunchpadButtonColor): void
}

const getClosestLegacyColor = (color: LaunchpadRGBButtonColor) => {
  const { r, g, b } = color.getRGB()
  const red = Math.round(r / 85).toString().padStart(2, "0")
  const green = Math.round(g / 85).toString().padStart(2, "0")
  return `#${red}${green}00`
}

export const Appearance: React.SFC<IAppearance> = (props) => {
  const { showContextMenu } = React.useContext(MenuContext.Context)
  // Look functions
  const setLookType = (mode: LaunchpadButtonLookType) => {
    if (mode === LaunchpadButtonLookType.Image) {
      props.onChangeLook(new LaunchpadButtonLookImage('data:image/gif;base64,R0lGODlhAQABAIAAAP')); // blank gif
    } else if (mode === LaunchpadButtonLookType.Text) {
      props.onChangeLook(new LaunchpadButtonLookText('...'));
    }
  }

  const setLookImageUri = (uri: string) => {
    props.onChangeLook(new LaunchpadButtonLookImage(uri));
  }

  const setLookTextCaption = (caption: string) => {
    props.onChangeLook(Object.assign({}, props.look, { caption }));
  }

  const setLookTextFace = (face: string) => {
    props.onChangeLook(Object.assign({}, props.look, { face }));
  }

  const setLookTextSize = (size: number) => {
    props.onChangeLook(Object.assign({}, props.look, { size }));
  }

  const setLookTextColor = (color: string) => {
    props.onChangeLook(Object.assign({}, props.look, { color }));
  }

  // color functions
  const setColorMode = (mode: LaunchpadButtonColorMode, color: LaunchpadButtonColor, setColor: React.Dispatch<React.SetStateAction<LaunchpadButtonColor>>) => {
    if (mode === -1) return setColor(undefined);

    if (mode === LaunchpadButtonColorMode.Static) {
      setColor(new LaunchpadSolidButtonColor(LaunchpadSolidButtonColor.RandomIndex()))
    } else if (mode === LaunchpadButtonColorMode.Flashing) {
      setColor(new LaunchpadFlashingButtonColor(LaunchpadFlashingButtonColor.RandomIndex(), LaunchpadFlashingButtonColor.RandomIndex()))
    } else if (mode === LaunchpadButtonColorMode.Pulsing) {
      setColor(new LaunchpadPulsingButtonColor(LaunchpadPulsingButtonColor.RandomIndex()))
    } else if (mode === LaunchpadButtonColorMode.RGB) {
      setColor(new LaunchpadRGBButtonColor(LaunchpadRGBButtonColor.RandomRGB()))
    }
  }

  const setColorRGB = (rgb: string, setColor: React.Dispatch<React.SetStateAction<LaunchpadButtonColor>>) => {
    setColor(new LaunchpadRGBButtonColor(rgb));
  }

  const setColorSolid = (index: number, setColor: React.Dispatch<React.SetStateAction<LaunchpadButtonColor>>) => {
    setColor(new LaunchpadSolidButtonColor(index))
  }

  const setColorFlashingA = (index: number, color: LaunchpadFlashingButtonColor, setColor: React.Dispatch<React.SetStateAction<LaunchpadButtonColor>>) => {
    setColor(new LaunchpadFlashingButtonColor(index, color.alt));
  }

  const setColorFlashingB = (index: number, color: LaunchpadFlashingButtonColor, setColor: React.Dispatch<React.SetStateAction<LaunchpadButtonColor>>) => {
    setColor(new LaunchpadFlashingButtonColor(color.color, index));
  }

  const setColorPulsing = (index: number, setColor: React.Dispatch<React.SetStateAction<LaunchpadButtonColor>>) => {
    setColor(new LaunchpadPulsingButtonColor(index))
  }
  return (
    <Split direction="column" width="100%">
      <Row title="Look">
        <Select
          value={props.look.type}
          onChange={e => setLookType(parseInt(e.target.value) as LaunchpadButtonLookType)}
        >
          <option value={LaunchpadButtonLookType.Text}>Text</option>
          <option value={LaunchpadButtonLookType.Image}>Image</option>
        </Select>
      </Row>
      {props.look.type === LaunchpadButtonLookType.Text && (
        <LaunchpadButtonLookTextComponent
          look={props.look as LaunchpadButtonLookText}
          showContextMenu={showContextMenu}
          onChangeCaption={setLookTextCaption}
          onChangeFace={setLookTextFace}
          onChangeSize={setLookTextSize}
          onChangeColor={setLookTextColor}
        />
      )}
      {props.look.type === LaunchpadButtonLookType.Image && (
        <LaunchpadButtonLookImageComponent
          look={props.look as LaunchpadButtonLookImage}
          onChangeUri={setLookImageUri}
        />
      )}
      <Child padding="1rem 0.5rem 0 0">
        <Divider />
      </Child>
      {!props.limitedColor && (
        <Row title="Base color:">
          <Select
            value={props.baseColor.mode}
            onChange={e => setColorMode(parseInt(e.target.value) as LaunchpadButtonColorMode, props.baseColor, props.onChangeBaseColor)}
          >
            <option value={LaunchpadButtonColorMode.Static}>Solid (indexed)</option>
            <option value={LaunchpadButtonColorMode.Flashing}>Flashing (indexed)</option>
            <option value={LaunchpadButtonColorMode.Pulsing}>Pulsing (indexed)</option>
            <option value={LaunchpadButtonColorMode.RGB}>RGB</option>
          </Select>
        </Row>
      )}
      {!props.limitedColor ? (
        <>
          {props.baseColor.mode === LaunchpadButtonColorMode.Static && (
            <LaunchpadButtonSolidColorComponent
              showContextMenu={showContextMenu}
              color={props.baseColor as LaunchpadSolidButtonColor}
              onChangeColor={idx => setColorSolid(idx, props.onChangeBaseColor)}
            />
          )}
          {props.baseColor.mode === LaunchpadButtonColorMode.Flashing && (
            <LaunchpadButtonFlashingColorComponent
              color={props.baseColor as LaunchpadFlashingButtonColor}
              showContextMenu={showContextMenu}
              onChangeColorA={idx => setColorFlashingA(idx, props.baseColor as LaunchpadFlashingButtonColor, props.onChangeBaseColor)}
              onChangeColorB={idx => setColorFlashingB(idx, props.baseColor as LaunchpadFlashingButtonColor, props.onChangeBaseColor)}
            />
          )}
          {props.baseColor.mode === LaunchpadButtonColorMode.Pulsing && (
            <LaunchpadButtonPulsingColorComponent
              color={props.baseColor as LaunchpadPulsingButtonColor}
              showContextMenu={showContextMenu}
              onChangeColor={idx => setColorPulsing(idx, props.onChangeBaseColor)}
            />
          )}
          {props.baseColor.mode === LaunchpadButtonColorMode.RGB && (
            <LaunchpadButtonRGBColorComponent
              color={props.baseColor as LaunchpadRGBButtonColor}
              showContextMenu={showContextMenu}
              onChangeColor={color => setColorRGB(color, props.onChangeBaseColor)}
            />
          )}
        </>
      ) : (
        <LaunchpadButtonLegacyColorComponent
          color={props.baseColor as LaunchpadRGBButtonColor}
          showContextMenu={showContextMenu}
          onChangeColor={color => setColorRGB(color, props.onChangeBaseColor)}
        />
      )}
      <Child padding="1rem 0.5rem 0 0">
        <Divider />
      </Child>
      <Row title="Active color:">
        <Select
          value={props.activeColor ? props.activeColor.mode : -1}
          onChange={e => setColorMode(parseInt(e.target.value) as LaunchpadButtonColorMode, props.activeColor, props.onChangeActiveColor)}
        >
          <option value={-1}>Same as base color</option>
          {props.limitedColor && <option value={LaunchpadButtonColorMode.RGB}>Pick color</option>}
          {!props.limitedColor && (
            <>
              <option value={LaunchpadButtonColorMode.Static}>Solid (indexed)</option>
              <option value={LaunchpadButtonColorMode.Flashing}>Flashing (indexed)</option>
              <option value={LaunchpadButtonColorMode.Pulsing}>Pulsing (indexed)</option>
              <option value={LaunchpadButtonColorMode.RGB}>RGB</option>
            </>
          )}
        </Select>
      </Row>
      {props.activeColor && (
        <>
          {!props.limitedColor ? (
            <>
              {props.activeColor.mode === LaunchpadButtonColorMode.Static && (
                <LaunchpadButtonSolidColorComponent
                  color={props.activeColor as LaunchpadSolidButtonColor}
                  showContextMenu={showContextMenu}
                  onChangeColor={idx => setColorSolid(idx, props.onChangeActiveColor)}
                />
              )}
              {props.activeColor.mode === LaunchpadButtonColorMode.Flashing && (
                <LaunchpadButtonFlashingColorComponent
                  color={props.activeColor as LaunchpadFlashingButtonColor}
                  showContextMenu={showContextMenu}
                  onChangeColorA={idx => setColorFlashingA(idx, props.activeColor as LaunchpadFlashingButtonColor, props.onChangeActiveColor)}
                  onChangeColorB={idx => setColorFlashingB(idx, props.activeColor as LaunchpadFlashingButtonColor, props.onChangeActiveColor)}
                />
              )}
              {props.activeColor.mode === LaunchpadButtonColorMode.Pulsing && (
                <LaunchpadButtonPulsingColorComponent
                  color={props.activeColor as LaunchpadPulsingButtonColor}
                  showContextMenu={showContextMenu}
                  onChangeColor={idx => setColorPulsing(idx, props.onChangeActiveColor)}
                />
              )}
              {props.activeColor.mode === LaunchpadButtonColorMode.RGB && (
                <LaunchpadButtonRGBColorComponent
                  color={props.activeColor as LaunchpadRGBButtonColor}
                  showContextMenu={showContextMenu}
                  onChangeColor={color => setColorRGB(color, props.onChangeActiveColor)}
                />
              )}
            </>
          ) : (
            <LaunchpadButtonLegacyColorComponent
              color={props.activeColor as LaunchpadRGBButtonColor}
              showContextMenu={showContextMenu}
              onChangeColor={color => setColorRGB(color, props.onChangeActiveColor)}
            />
          )}
        </>
      )}
    </Split>
  )
}