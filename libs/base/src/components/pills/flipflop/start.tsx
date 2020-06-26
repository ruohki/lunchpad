import * as React from 'react';

import { FlipFlopStart } from '@lunchpad/types';
import { Icon, FlipFlop } from '@lunchpad/icons';

import { Pill } from '../pill'
import { Split, Child } from '../../basic/layout';

interface IFlipFlopPill {
  action: FlipFlopStart
  expanded?: boolean
  onChange?: (action: FlipFlopStart) => void
  onRemove?: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
}

export const FlipFlopStartPill: React.SFC<IFlipFlopPill> = ({ action, onRemove, onMoveUp, onMoveDown }) => {
  const Expanded = (
    <Split direction="row">
      <Child grow whiteSpace="nowrap" padding="0 1rem 0 0"><div style={{textOverflow: "ellipsis", overflow: "hidden"}}>FlipFlop: A ({action.isA ? "A" : "B"} will run next)</div></Child>
    </Split>
  )
    
  return (
    <Pill
      isExpanded={false}
      expandable={false}
      icon={<Icon icon={FlipFlop} />}
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

FlipFlopStartPill.defaultProps = {
  expanded: false,
  onChange: () => {},
  onRemove: () => {},
}