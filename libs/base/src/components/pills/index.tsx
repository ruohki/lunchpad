
import * as React from 'react';
import { Split, Child, ScrollBox} from '../basic'

interface IPillList {
  header: JSX.Element
}

export const PillList: React.SFC<IPillList> = (props) => {
  return (
    <Split height="100%">
      <Child >
        {props.header}
      </Child>
      <ScrollBox >
        <Child grow>
          {props.children}
        </Child>
      </ScrollBox>
    </Split>
  )
}