import React from 'react'
import styled from 'styled-components';

import { SliderPicker } from 'react-color'
import Circle from 'react-color/lib/Circle'

import { Color } from '@lunchpad/types'

interface ILaunchpadColorPicker {
  color: Color
  onChange: (color: Color) => void;
}

const ColorContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
`

const StyledCircle = styled(Circle)`
  margin-top: 1rem;
  justify-content: space-between;
  
  & > span {
    transform: translatex(25%);
  }
`

const StyledSlider = styled(SliderPicker)`
  margin: 2rem 1rem 1rem 1rem;
  
  .hue-horizontal {
    border-radius: 99px;
  }
`

const colors = ['#000000', '#FFFFFF', '#4D4D4D', '#999999',  '#F44E3B', '#FE9200', '#FCDC00', '#DBDF00', '#A4DD00', '#68CCCA', '#73D8FF', '#AEA1FF', '#FDA1FF', '#333333', '#808080', '#cccccc', '#D33115', '#E27300', '#FCC400', '#B0BC00', '#68BC00', '#16A5A5', '#009CE0', '#7B64FF', '#FA28FF', '#666666', '#B3B3B3', '#9F0500', '#C45100', '#FB9E00', '#808900', '#194D33', '#0C797D', '#0062B1', '#653294', '#AB149E']

const LaunchpadColorPicker: React.SFC<ILaunchpadColorPicker> = ({ color, onChange }) => {
  const change = ({ rgb }) => onChange(rgb);
  return (
    <ColorContainer>
      <StyledCircle
        style={{ }}
        width="100%"
        circleSize={18}
        colors={colors}
        color={color}
        onChangeComplete={(args) => {
          console.log(args)
          change(args)
        }}
      />
      <StyledSlider
        color={color}
        onChangeComplete={change}
      />
    </ColorContainer>
  )
}

export default LaunchpadColorPicker