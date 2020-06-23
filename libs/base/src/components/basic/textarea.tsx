import * as React from 'react';
import styled from 'styled-components';
import { COLOR_WHITE, COLOR_BLURPLE, COLOR_NOTBLACK } from '../../theme/colors';
import { lighten, darken } from 'polished';

interface ITextAreaProps {
  color?: string;
  padding?: string;
  height?: string;
}

export const Textarea = styled.textarea<ITextAreaProps>`
  width: 100%;
  height: ${props => props.height};
  appearance: none;
  display: block;
  padding: ${props => props.padding};
  caret-color: ${COLOR_BLURPLE};
  color: ${COLOR_WHITE};
  background-color: ${({color}) => color};
  border: 2px solid ${({color}) => darken(0.05, color)};
  resize: none;

  border-radius: 7px;
  
  font-size: 1.6rem;
  font-weight: normal;
  font-style: normal;

  outline: 0px;

  transition: background-color 0.2s ease;
  &:hover {
    background-color: ${({color}) => lighten(0.05, color)};
  }
`

Textarea.defaultProps = {
  color: COLOR_NOTBLACK,
  padding: "0.75rem",
  height: "400px"
}