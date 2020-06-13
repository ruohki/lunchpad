import * as React from 'react';
import styled from "styled-components";

import { Icon, Check, Cross } from '@lunchpad/icons';
import { darken, lighten } from 'polished';
import { COLOR_NOTBLACK, COLOR_BLURPLE, COLOR_REDISH } from '../../theme';


import ButtonMask from '../../../assets/buttonMask';

interface IContainerProps {
  color: string
}
const Container = styled.div<IContainerProps>`
  display: flex;
  width: 56px;
  height: 30px;
  background-color: ${({color}) => color};
  border-radius: 999px;
  border: 2px solid ${({color}) => darken(0.05, color)};
  align-items: center;
  justify-content: flex-start;
  padding-left: 3px;
  padding-right: 3px;
  cursor: pointer;
  box-shadow: inset 0 0 0.5em 0.5em ${darken(0.075,COLOR_NOTBLACK)};
`;

interface IPusher {
  enabled: boolean
}
const Pusher = styled.div<IPusher>`
  transition: flex-grow 0.25s ease;
  flex-grow: ${props => (props.enabled ? 1 : 0)};
`;

const Knob = styled.div<IPusher>`
position: relative;
  background-color: blue;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: ${props => props.enabled ? COLOR_BLURPLE : COLOR_REDISH};
  background-image: url(${ButtonMask});
  background-size: contain;
  transition: background 0.25s ease;
`;

const IconContainer = styled.div<IPusher>`
  position: absolute;
  opacity: ${props => props.enabled ? 1 : 0};
  
  transition: all 0.25s ease;
  
  transform: rotate(${props => props.enabled ? 0 : 180}deg);
  &:nth-child(1) {
    transform: rotate(${props => props.enabled ? 0 : -180}deg);
  }
`

export interface ISwitchProps {
  value: boolean
  onChange: (value: boolean) => void
  color?: string;
}

export const Switch: React.SFC<ISwitchProps> = ({ color, value, onChange }) => {
  return (
    <Container color={color} onClick={() => onChange(!value)}>
      <Pusher enabled={value} />
      <Knob enabled={value}>
        <IconContainer enabled={value}>
          <Icon icon={Check} />
        </IconContainer>
        <IconContainer enabled={!value}>
          <div style={{ transform: "translate(-5%,-2%)" }} >
            <Icon icon={Cross} />
          </div>
        </IconContainer>
      </Knob>
    </Container>
  );
};

Switch.defaultProps = {
  color: COLOR_NOTBLACK
}