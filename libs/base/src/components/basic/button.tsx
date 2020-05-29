import * as React from 'react';
import styled from 'styled-components';
import { COLOR_WHITE, COLOR_BLURPLE, COLOR_GRAY } from '../../theme/colors';
import { lighten, darken } from 'polished';

const { shell } = window.require('electron');

interface IButtonProps {
  color?: string;
  padding?: string;
  height?: string;
}

export const Button = styled.button<IButtonProps>`
  height: ${props => props.height};
  white-space: nowrap;
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
  
  outline: 0px;

  transition: background-color 0.2s ease;
  
  &:hover {
    background-color: ${({color}) => lighten(0.05, color)};
  }

  &:active {
    background-color: ${({color}) => darken(0.05, color)};
  }
`

Button.defaultProps = {
  color: COLOR_BLURPLE,
  padding: "4px 50px 8px 50px",
  height: "35px"
}

interface IIconButton {
  hover?: string;
  disabled?: boolean
}

export const IconButton = styled(({ icon, ...rest }) => (
  <button {...rest}>{icon}</button>
))<IIconButton>`
  background: none;
  border: none;
  color: ${(props) => props.disabled ? darken(0.3, COLOR_GRAY) : COLOR_GRAY};
  outline: none;
  transition: color 0.2s ease;
  cursor: ${(props) => props.disabled ? 'cursor' : 'pointer'};
  
  &:hover {
    color: ${props => props.disabled ? darken(0.3, COLOR_GRAY) : props.hover};
  }
`

IconButton.defaultProps = {
  hover: COLOR_WHITE,
  disabled: false

}

export const LinkButton = styled(({ href, ...rest}) => (
  <span {...rest} onClick={() => shell.openExternal(href)} />
))`
  color: ${COLOR_BLURPLE};
  cursor: pointer;

  transition: color 0.25s ease;

  &:hover {
    text-decoration: underline;
    color: ${lighten(0.2, COLOR_BLURPLE)}
  }

  &:active {
    text-decoration: underline;
    color: ${darken(0.2, COLOR_BLURPLE)}
  }
`