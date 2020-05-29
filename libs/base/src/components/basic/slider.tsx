
import * as React from 'react';
import styled from 'styled-components';
import { COLOR_BLACK, COLOR_WHITE, COLOR_BLURPLE } from '../../theme';

export const Slider = styled.input.attrs({
  type: "range"
})`
  overflow: hidden;
  display: block;
  appearance: none;
  
  width: 100%;
  margin: 0;
  height: 1.5rem;
  cursor: pointer;

  background-color: transparent;

  &::-webkit-slider-runnable-track {
    width: 100%;
    height: 0.5rem;
    background: ${COLOR_BLACK};
  }

  &::-webkit-slider-thumb {
    position: relative;
    appearance: none;
    height: 1.5rem;
    width: 1rem;
    background: ${COLOR_WHITE};
    border-radius: 3px;
    border: 0;
    top: 50%;
    transform: translateY(-50%);
    transition: background-color 150ms;
  }

  &:hover,
  &:focus {
    outline: none;
    &::-webkit-slider-thumb {
      background-color: ${COLOR_BLURPLE};
    }
  }
`