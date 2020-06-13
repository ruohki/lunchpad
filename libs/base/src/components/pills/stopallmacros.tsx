import * as React from 'react';
import * as _ from 'lodash';

import { StopAllMacros } from '@lunchpad/types';
import { Icon, Stop } from '@lunchpad/icons';

import { Pill } from './pill'
import { Split, Child } from '../basic/layout';

interface IStopAllMacrosPill {
  action: StopAllMacros
  expanded?: boolean
  onChange?: (action: StopAllMacros) => void
  onRemove?: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
}

export const StopAllMacrosPill: React.SFC<IStopAllMacrosPill> = ({ action, expanded, onChange, onRemove, onMoveUp, onMoveDown }) => {
  const Expanded = (
    <Split direction="row">
      <Child grow whiteSpace="nowrap" padding="0 1rem 0 0"><div style={{textOverflow: "ellipsis", overflow: "hidden"}}>Stop all running macros</div></Child>
    </Split>
  )
    
  return (
    <Pill
      isExpanded={false}
      expandable={false}
      icon={<Icon icon={Stop} />}
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

StopAllMacrosPill.defaultProps = {
  expanded: false,
  onChange: () => {},
  onRemove: () => {},
}