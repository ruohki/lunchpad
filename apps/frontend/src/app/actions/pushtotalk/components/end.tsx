import * as React from 'react';

import { Icon, ButtonUp } from '@lunchpad/icons';
import { Split, Child } from '@lunchpad/base';

import Pill from '../../pill';

import { PushToTalkEnd } from '../classes';

interface IPushToTalkEndPill {
  action: PushToTalkEnd
  expanded?: boolean
  onChange?: (action: PushToTalkEnd) => void
  onRemove?: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
}

export const PushToTalkEndPill: React.SFC<IPushToTalkEndPill> = (props) => {
  const Expanded = (
    <Split direction="row">
      <Child grow whiteSpace="nowrap" padding="0 1rem 0 0"><div style={{textOverflow: "ellipsis", overflow: "hidden"}}>Push-to-talk: Release</div></Child>
    </Split>
  )
    
  return (
    <Pill
      isExpanded={false}
      expandable={false}
      icon={<Icon icon={ButtonUp} />}
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