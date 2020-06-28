import * as React from 'react';

import { Icon, ButtonDown } from '@lunchpad/icons';
import { Split, Child } from '@lunchpad/base';

import Pill from '../../pill';

import { PushToTalkStart } from '../classes';

interface IPushToTalkStartPill {
  action: PushToTalkStart
  expanded?: boolean
  onChange?: (action: PushToTalkStart) => void
  onRemove?: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
}

export const PushToTalkStartPill: React.SFC<IPushToTalkStartPill> = (props) => {
  const Expanded = (
    <Split direction="row">
      <Child grow whiteSpace="nowrap" padding="0 1rem 0 0"><div style={{textOverflow: "ellipsis", overflow: "hidden"}}>Push-to-talk: Push</div></Child>
    </Split>
  )
    
  return (
    <Pill
      isExpanded={false}
      expandable={false}
      icon={<Icon icon={ButtonDown} />}
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

PushToTalkStartPill.defaultProps = {
  expanded: false,
  onChange: () => {},
  onRemove: () => {},
}