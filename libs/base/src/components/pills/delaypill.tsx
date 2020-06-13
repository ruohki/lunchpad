import * as React from 'react';
import * as _ from 'lodash';

import { Delay } from '@lunchpad/types';
import { Icon, Stopwatch } from '@lunchpad/icons';

import { Pill } from './pill'
import { Split, Child, VerticalPipe, Row } from '../basic/layout';
import { Input } from '../basic';

interface IDelayPill {
  action: Delay
  expanded?: boolean
  onChange?: (action: Delay) => void
  onRemove?: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
}

export const DelayPill: React.SFC<IDelayPill> = ({ action, expanded, onChange, onRemove, onMoveUp, onMoveDown }) => {
  const [ showBody, setExpanded ] = React.useState<boolean>(expanded);

  const setDelay = (val: number) => {
    const actn = new Delay(
      val,
      action.id
    )
    onChange(actn)
  }

  const Expanded = (
    <Split direction="row">
      <Child grow whiteSpace="nowrap" padding="0 1rem 0 0"><div style={{textOverflow: "ellipsis", overflow: "hidden"}}>Delay: {action.delay}ms</div></Child>
    </Split>
  )

  return (
    <Pill
      isExpanded={showBody}
      icon={<Icon icon={Stopwatch} />}
      expanded={Expanded}
      collapsed={Expanded}
      onRemove={() => onRemove(action.id)}
      onMoveUp={onMoveUp ? () => onMoveUp(action.id) : null}
      onMoveDown={onMoveDown ? () => onMoveDown(action.id) : null}
      onExpand={() => setExpanded(true)}
      onCollapse={() => setExpanded(false)}
    >
      <Split padding="0 0 1rem 0">
        <Row title="Delay:">
          <Split direction="row">
            <Child grow padding="0 1rem 0 0">
              <Input value={action.delay} onChange={e => {
                setDelay(Math.round(parseInt(e.target.value)) || 0)
              }} />
            </Child>
            <Child>
              <span style={{ whiteSpace: "nowrap"}}>milliseconds (ms)</span>
            </Child>
          </Split>
        </Row>
      </Split>
    </Pill>
    
  )
}

DelayPill.defaultProps = {
  expanded: false,
  onChange: () => {},
  onRemove: () => {},
}