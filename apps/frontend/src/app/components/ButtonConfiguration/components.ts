import * as React from 'react';

import styled from 'styled-components';
import { COLOR_NOTBLACK, COLOR_WHITE } from '@lunchpad/base';
import { darken } from 'polished';


interface IBorderProps {
  color?: string;
  padding?: string;
}

export const Border = styled.div<IBorderProps>`
  width: 100%;
  
  appearance: none;
  display: block;
  padding: ${props => props.padding};
  color: ${COLOR_WHITE};
  background-color: ${({color}) => color};
  border: 2px solid ${({color}) => darken(0.05, color)};
  
  border-radius: 7px;
  
  font-size: 1.6rem;
  font-weight: normal;
  font-style: normal;
`

Border.defaultProps = {
  color: COLOR_NOTBLACK,
  padding: "0.75rem"
}