import * as React from 'react';
import * as _ from 'lodash';

import { PushToTalkEnd } from '@lunchpad/types';
import { Icon, ButtonUp } from '@lunchpad/icons';

import { Pill } from '../pill'
import { Split, Child } from '../../basic/layout';

interface IPushToTalkPill {
  action: PushToTalkEnd
  expanded?: boolean
  onChange?: (action: PushToTalkEnd) => void
  onRemove?: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
}

export const PushToTalkEndPill: React.SFC<IPushToTalkPill> = ({ action, onRemove, onMoveUp, onMoveDown }) => {
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
      onRemove={() => onRemove(action.id)}
      onMoveUp={onMoveUp ? () => onMoveUp(action.id) : null}
      onMoveDown={onMoveDown ? () => onMoveDown(action.id) : null}
      onExpand={() => {}}
      onCollapse={() => {}}
    />
  )
}

PushToTalkEndPill.defaultProps = {
  expanded: false,
  onChange: () => {},
  onRemove: () => {},
}