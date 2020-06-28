import * as React from 'react';
import styled from 'styled-components';
import * as svgson from 'svgson';

interface IIconData {
  data: any
  width: number
  height: number
}

interface IIcon {
  icon: IIconData
  color?: string
}

const Container = styled.div`
  display: inline-flex;
  align-self: center;

  `
const SVGParent = styled.div`
  & > svg {
    top: .125em;
    position: relative;
    width: 1em;
    height: 1em;
    fill: currentColor;
  }
`


const IconSFC: React.SFC<IIcon> = (props) => {
  const data = props.icon.data;
  return (
    <Container>
      <SVGParent
        dangerouslySetInnerHTML={{ __html: svgson.stringify(data)}}
      />
    </Container>
  )
}

export const Icon = styled(IconSFC)<IIcon>`
  color: ${(props) => props.color};
`

Icon.defaultProps = {
  color: "white"
}