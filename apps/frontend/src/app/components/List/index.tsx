import * as React from 'react';
import styled from 'styled-components';
import { darken } from 'polished';

import { COLOR_MENU, Split, Child, ScrollBox } from '@lunchpad/base';

interface IList {
  menu?: JSX.Element
  elements?: JSX.Element[]
}

export const ListItem = styled(Child)`
  border-radius: 8px;
  margin-bottom: 1rem;

  transition: background-color 0.25s ease;
  &:hover {
    background-color: ${darken(0.01, COLOR_MENU)};
  }
`

ListItem.defaultProps = {
  padding: "1rem",
  backgroundColor: darken(0.02, COLOR_MENU)
}

const List: React.SFC<IList> = (props) => {
  return (
    <Split padding="1rem" height="100%">
      <Child >
        {props.menu}
      </Child>
      <ScrollBox >
        <Child grow>
          {props.children}
        </Child>
      </ScrollBox>
    </Split>
  )
}

List.defaultProps = {
  elements: []
}
export default List;