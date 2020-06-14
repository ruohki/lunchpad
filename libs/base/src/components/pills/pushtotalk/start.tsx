import * as React from 'react';
import * as _ from 'lodash';

import { PushToTalkStart } from '@lunchpad/types';
import { Icon, ButtonDown } from '@lunchpad/icons';

import { Pill } from '../pill'
import { Split, Child } from '../../basic/layout';

interface IPushToTalkPill {
  action: PushToTalkStart
  expanded?: boolean
  onChange?: (action: PushToTalkStart) => void
  onRemove?: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
}

export const PushToTalkStartPill: React.SFC<IPushToTalkPill> = ({ action, onRemove, onMoveUp, onMoveDown }) => {
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
      onRemove={() => onRemove(action.id)}
      onMoveUp={onMoveUp ? () => onMoveUp(action.id) : null}
      onMoveDown={onMoveDown ? () => onMoveDown(action.id) : null}
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