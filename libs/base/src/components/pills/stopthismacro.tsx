import * as React from 'react';
import * as _ from 'lodash';

import { StopThisMacro } from '@lunchpad/types';
import { IconTrafficLightStop } from '@lunchpad/icons';

import { Pill } from './pill'
import { Split, Child } from '../basic/layout';

interface IStopAllMacrosPill {
  action: StopThisMacro
  expanded?: boolean
  onChange?: (action: StopThisMacro) => void
  onRemove?: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
}

export const StopThisMacroPill: React.SFC<IStopAllMacrosPill> = ({ action, onRemove, onMoveUp, onMoveDown }) => {
  const Expanded = (
    <Split direction="row">
      <Child grow whiteSpace="nowrap" padding="0 1rem 0 0"><div style={{textOverflow: "ellipsis", overflow: "hidden"}}>Stop this macro</div></Child>
    </Split>
  )
    
  return (
    <Pill
      isExpanded={false}
      expandable={false}
      icon={<IconTrafficLightStop />}
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

StopThisMacroPill.defaultProps = {
  expanded: false,
  onChange: () => {},
  onRemove: () => {},
}