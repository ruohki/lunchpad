import * as React from 'react';
import styled from 'styled-components';
import { LaunchpadButtonLook, LaunchpadButtonLookType, LaunchpadButtonLookText, LaunchpadButtonLookImage } from '../../contexts/layout/classes';

interface IPadContainer {
  width: number
  height: number
}

export const PadContainer = styled.div<IPadContainer>`
  width: 100%;
  height: 100%;
  display: grid;
  grid-gap: 0;
  grid-template-columns: repeat(${props => props.width}, [col] calc(100% / ${props => props.width}));
  grid-template-rows: repeat(${props => props.height}, [row] calc(100% / ${props => props.height}));

  justify-content: center;
`;


export const PadContainerProMK3 = styled.div`
  width: 100%;
  height: 100%;
  display: grid;
  grid-gap: 0;
  grid-template-columns: repeat(10, [col] calc(100% / 10));
  grid-template-rows: repeat(9, [row] 2fr) 1fr 1fr;
  
  justify-content: center;
`;


interface IButtonFaceText {
  face: string
  size: number
  color: string
}

export const ButtonFaceText = styled.span<IButtonFaceText>`
  font-family: "${props => props.face}" !important;
  font-size: ${props => props.size}px !important;
  color: ${props => props.color} !important;
`

interface IButtonFaceImage {
  
}

export const ButtonFaceImage = styled.img<IButtonFaceImage>`
  padding: 0.25rem 0.25rem 0.5rem 0.25rem;
  width: 90%;
  height: auto;
  
`

interface IButtonLookComponent {
  look: LaunchpadButtonLook
}

export const ButtonLook: React.SFC<IButtonLookComponent> = (props) => {
  if (props.look.type === LaunchpadButtonLookType.Text) {
    const textLook = props.look as LaunchpadButtonLookText;
    return (
      <ButtonFaceText
        face={textLook.face}
        size={textLook.size}
        color={textLook.color}
      >
        {textLook.caption}
      </ButtonFaceText>
    )
  } else if (props.look.type === LaunchpadButtonLookType.Image) {
    const imgLook = props.look as LaunchpadButtonLookImage;
    return (
      <ButtonFaceImage
        draggable="false"
        src={imgLook.uri}
      />
    )
  }
}