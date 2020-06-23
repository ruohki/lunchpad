import React from 'react';
import styled from 'styled-components';

import { COLOR_BLACK, COLOR_ALMOSTBLACK, COLOR_MENU, COLOR_WHITE, COLOR_GRAY, Split, Child } from '@lunchpad/base';

export const Tab = styled(({ title, active, ...rest}) => (
  <div active={active ? 1 : 0} {...rest}><h4>{title}</h4></div>
))`
  background-color: ${(props) => props.active ? COLOR_MENU : COLOR_BLACK};
  color: ${(props) => props.active ? COLOR_WHITE : COLOR_GRAY};
  padding:  1rem 3rem 1rem 3rem;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.25s ease, background-color 0.25s ease;
  
  &:hover {
    color: ${COLOR_WHITE};
  }
`

Tab.defaultProps = {
  active: false,
}

export const Divider = styled.hr`
  margin: 0;
  border: 1px solid ${COLOR_ALMOSTBLACK};
`
export const Row = ({ title, children }) => (
  <Split margin="1rem 1rem 0 1rem" direction="row">
    <Child basis="25%" align="center" text="right"  margin="0 1rem 0 0">
      <div>
        {title}
      </div>
    </Child>
    <Child basis="75%">
      {children}
    </Child>
  </Split>
)

export const EditInput = styled.input`
  background: transparent;
  border: none;
  outline: none;
  color: ${COLOR_WHITE};

  user-select: none;
`