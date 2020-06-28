import * as React from 'react';

import { Icon, Stop } from '@lunchpad/icons';
import { Split, Child } from '@lunchpad/base';

import Pill from '../pill'
import { RestartThisMacro } from './classes';

interface IRestartThisMacro {
  action: RestartThisMacro
  expanded?: boolean
  onChange?: (action: RestartThisMacro) => void
  onRemove?: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
}

export const RestartThisMacroPill: React.SFC<IRestartThisMacro> = (props) => {
  const Expanded = (
    <Split direction="row">
      <Child grow whiteSpace="nowrap" padding="0 1rem 0 0"><div style={{textOverflow: "ellipsis", overflow: "hidden"}}>Restart this macro</div></Child>
    </Split>
  )
    
  return (
    <Pill
      isExpanded={false}
      expandable={false}
      icon={<Icon icon={Stop} />}
      expanded={Expanded}
      collapsed={Expanded}
      onRemove={() => props.onRemove(props.action.id)}
      onMoveUp={props.onMoveUp ? () => props.onMoveUp(props.action.id) : null}
      onMoveDown={props.onMoveDown ? () => props.onMoveDown(props.action.id) : null}
      onExpand={() => {}}
      onCollapse={() => {}}
    />
  )
}

RestartThisMacroPill.defaultProps = {
  expanded: false,
  onChange: () => {},
  onRemove: () => {},
}