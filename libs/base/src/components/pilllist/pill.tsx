import * as React from 'react';
import styled from 'styled-components';
import { COLOR_MENU } from '../../theme/colors';
import { darken, lighten } from 'polished';
import { Child, Split } from '../basic';

import { Action } from '@lunchpad/types';

export interface IPill {
  expanded?: boolean
  action: Action
  component: any
}

interface IPillBorder {
  show: boolean
}

interface IPillHeader {
  expanded: boolean
}

const PillHover = `
  &:hover {
    cursor: pointer;
    background-color: ${darken(0.02, COLOR_MENU)};
  }
`

export const PillHeader = styled(Child)<IPillHeader>`
  padding: 1rem;
  background-color: ${props => darken(props.expanded ? 0.02 : 0.01, COLOR_MENU)};

  ${props => !props.expanded ? PillHover : ''}
`

export const PillBorder = styled(Split)<IPillBorder>`
  border: 2px solid ${props => darken(props.show ? 0.02 : 0.01, COLOR_MENU)};
  border-radius: 8px;
  overflow: hidden;

  &:hover {
    border-color: ${darken(0.02, COLOR_MENU)};
  }
`

PillBorder.defaultProps = {
  margin: "0 0 1rem 0"
}

export const PillBody = styled(Child)`
  padding: 1rem;
  border-radius: 0 0 8px 8px;
  background-color: ${lighten(0.03, COLOR_MENU)};
`