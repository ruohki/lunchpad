import * as React from 'react';
import { LaunchpadButtonLookText, LaunchpadButtonLookImage, LaunchpadSolidButtonColor, LaunchpadFlashingButtonColor, LaunchpadPulsingButtonColor, LaunchpadRGBButtonColor } from '@lunchpad/types';
import { Input, Split, Child, Switch, File, Slider, Select } from '@lunchpad/base';
import { Row } from '../Settings/components';
import { FullPillPicker } from '../Colorpicker/full';
import { RGBIndexPillPicker } from '../Colorpicker/rgbindex';
import { RGBIndexPalette, Small, Limited } from '../Colorpicker/palettes';
import { StyledCircle } from '../Colorpicker/components';

interface ILaunchpadButtonLookTextComponent {
  look: LaunchpadButtonLookText
  onChangeCaption: (caption: string) => void
  onChangeFace: (face: string) => void
  onChangeSize: (size: number) => void
  onChangeColor: (color: string) => void
}

export const LaunchpadButtonLookTextComponent: React.SFC<ILaunchpadButtonLookTextComponent> = (props) => (
  <>
    <Row title="Title:">
      <Input face={props.look.face} value={props.look.caption} onChange={e => props.onChangeCaption(e.target.value)} />
    </Row>
    <Row title="Appearance:">
      <Split direction="row">
        <Child basis="33%" padding="0 0.5rem 0 0">
          <Select
            value={props.look.face}
            onChange={e => props.onChangeFace(e.target.value)}
          >
            <option value="Exo 2">Exo 2 (default)</option>
            <option value="Roboto">Roboto</option>
            <option value="Source Sans Pro">Source Sans Pro</option>
            <option value="Oswald">Oswald</option>
            <option value="Noto Serif">Noto Serif</option>
            <option value="Font Awesome 5 Free">FontAwesome Free Regular</option>
            <option value="Font Awesome 5 Brands">FontAwesome Free Brands</option>
          </Select>
        </Child>
        <Child basis="33%" padding="0 0.5rem 0 0.5rem">
          <Split direction="row">
            <Child grow>
              <Slider
                value={props.look.size / 73 * 100}
                onChange={e => props.onChangeSize(Math.round(parseInt(e.target.value) / 100 * 73) || 0)}
              />
            </Child>
            <Child padding="0 0 0 1rem">
              {props.look.size}px
            </Child>
          </Split>
        </Child>
        <Child basis="34%" padding="0 0 0 0.5rem">
          <FullPillPicker
            color={props.look.color}
            onChange={c => props.onChangeColor(c.hex)}
          />
        </Child>
      </Split>
    </Row>
  </>
)

interface ILaunchpadButtonLookImageComponent {
  look: LaunchpadButtonLookImage
  onChangeUri: (uri: string) => void
}

export const LaunchpadButtonLookImageComponent: React.SFC<ILaunchpadButtonLookImageComponent> = (props) => {
  const [ embed, setEmbed ] = React.useState<boolean>();

  const isDataUri = props.look.uri.startsWith("data");

  const size = isDataUri ? atob(props.look.uri.split(',')[1]).length : 0;
  const setFile = async (file: string) => {
    if (embed) {
      const blob = await fetch(file).then(r => r.blob());
      const dataUrl = await new Promise<string>(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      console.log(dataUrl)
      props.onChangeUri(dataUrl);
    } else {
      console.log(file)
      props.onChangeUri(file);
    }
  }

  return (
    <>
      <Row title="">
        <Split direction="row">
          <Child padding="0 1rem 0 0">
            <Switch
              value={embed}
              onChange={setEmbed}
            />
          </Child>
          <Child grow>
            <span>Embed image in config</span>
          </Child>
        </Split>
      </Row>
      <Row title="URI:">
        <File
          accept="image/gif,image/png,image/jpeg"
          value={props.look.uri.startsWith("data") ? `[embedded image] (${(size / 1024).toFixed(2)} KB)` : props.look.uri} onChange={setFile}
        />
      </Row>
    </>
  )
}

interface ILaunchpadButtonSolidColorComponent {
  color: LaunchpadSolidButtonColor
  onChangeColor: (color: number) => void
}

export const LaunchpadButtonSolidColorComponent: React.SFC<ILaunchpadButtonSolidColorComponent> = (props) => (
  <Row title="Color:">
    <Split direction="row">
      <Child basis="50%" padding="0 0.5rem 0 0">
        <RGBIndexPillPicker
          color={RGBIndexPalette[props.color.color] ?? '#000000'}
          onChange={c => props.onChangeColor(RGBIndexPalette.indexOf(c.hex))}
        />
      </Child>
    </Split>
  </Row>
)

interface ILaunchpadButtonFlashingColorComponent {
  color: LaunchpadFlashingButtonColor
  onChangeColorA: (color: number) => void
  onChangeColorB: (color: number) => void
}

export const LaunchpadButtonFlashingColorComponent: React.SFC<ILaunchpadButtonFlashingColorComponent> = (props) => (
  <Row title="Color:">
    <Split direction="row">
      <Child basis="50%" padding="0 0.5rem 0 0">
        <RGBIndexPillPicker
          color={RGBIndexPalette[props.color.color] ?? '#000000'}
          onChange={c => props.onChangeColorA(RGBIndexPalette.indexOf(c.hex))}
        />
      </Child>
      <Child basis="50%" padding="0 0 0 0.5rem">
        <RGBIndexPillPicker
          color={RGBIndexPalette[props.color.alt] ?? '#000000'}
          onChange={c => props.onChangeColorB(RGBIndexPalette.indexOf(c.hex))}
        />
      </Child>
    </Split>
  </Row>
)

interface ILaunchpadButtonPulsingColorComponent {
  color: LaunchpadPulsingButtonColor
  onChangeColor: (color: number) => void
}

export const LaunchpadButtonPulsingColorComponent: React.SFC<ILaunchpadButtonPulsingColorComponent> = (props) => (
  <Row title="Color:">
    <Split direction="row">
      <Child basis="50%" padding="0 0.5rem 0 0">
        <RGBIndexPillPicker
          color={RGBIndexPalette[props.color.color] ?? '#000000'}
          onChange={c => props.onChangeColor(RGBIndexPalette.indexOf(c.hex))}
        />
      </Child>
    </Split>
  </Row>
)

interface ILaunchpadButtonRGBColorComponent {
  color: LaunchpadRGBButtonColor
  onChangeColor: (color: string) => void
}

export const LaunchpadButtonRGBColorComponent: React.SFC<ILaunchpadButtonRGBColorComponent> = (props) => (
  <Row title="Color:">
    <Split direction="row">
      <Child basis="40%">
        <FullPillPicker
          color={props.color.color}
          onChange={c => props.onChangeColor(c.hex)}
        />
      </Child>
      <Child basis="60%" align="center" margin="-3px 0 0 0">
        <StyledCircle
          color={props.color.color}
          onChange={c => props.onChangeColor(c.hex)}
          width="100%"
          circleSize={16}
          colors={Small}
        />
      </Child>
    </Split>
  </Row>
)

interface ILaunchpadButtonLegacyColorComponent {
  color: LaunchpadRGBButtonColor
  onChangeColor: (color: string) => void
}

export const LaunchpadButtonLegacyColorComponent: React.SFC<ILaunchpadButtonLegacyColorComponent> = (props) => (
  <Row title="Color:">
    <Split direction="row">
      <Child grow padding="0 0 0.5rem 0">
        <StyledCircle
          color={props.color.color}
          onChange={c => props.onChangeColor(c.hex)}
          width="100%"
          circleSize={14}
          colors={Limited}
        />
      </Child>
    </Split>
  </Row>
)