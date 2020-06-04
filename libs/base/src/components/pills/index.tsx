
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

export * from './pill'

export * from './audiopill'
export * from './delaypill'
export * from './switchpagepill'
export * from './stopallmacros'
export * from './texttospeech'
export * from './launchapppill'
export * from './hotkeypill'

