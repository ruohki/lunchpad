import * as React from 'react';

import { Delay } from './classes';
import { Icon, Stopwatch } from '@lunchpad/icons';

import Pill from '../pill'
import { Split, Child, Row, Input } from '@lunchpad/base';


interface IDelayPill {
  action: Delay
  expanded?: boolean
  onChange?: (action: Delay) => void
  onRemove?: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
}

export const DelayPill: React.SFC<IDelayPill> = (props) => {
  const [ showBody, setExpanded ] = React.useState<boolean>(props.expanded);

  const setDelay = (val: number) => {
    const actn = new Delay(
      val,
      props.action.id
    )
    props.onChange(actn)
  }

  const Expanded = (
    <Split direction="row">
      <Child grow whiteSpace="nowrap" padding="0 1rem 0 0"><div style={{textOverflow: "ellipsis", overflow: "hidden"}}>Delay: {props.action.delay}ms</div></Child>
    </Split>
  )

  return (
    <Pill
      isExpanded={showBody}
      icon={<Icon icon={Stopwatch} />}
      expanded={Expanded}
      collapsed={Expanded}
      onRemove={() => props.onRemove(props.action.id)}
      onMoveUp={props.onMoveUp ? () => props.onMoveUp(props.action.id) : null}
      onMoveDown={props.onMoveDown ? () => props.onMoveDown(props.action.id) : null}
      onExpand={() => setExpanded(true)}
      onCollapse={() => setExpanded(false)}
    >
      <Split padding="0 0 1rem 0">
        <Row title="Delay:">
          <Split direction="row">
            <Child grow padding="0 1rem 0 0">
              <Input value={props.action.delay} onChange={e => {
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