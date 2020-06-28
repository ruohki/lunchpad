import * as React from 'react';
import lodash from 'lodash';

import { Icon, OBS } from '@lunchpad/icons';
import { Split, Child, Row, Select, Button, Input, Switch } from '@lunchpad/base';

import Pill from '../../pill'
import { OBSToggleStreaming, StartOrStop, ToggleTarget } from './classes';

interface IOBSToggleStreamingPill {
  action: OBSToggleStreaming
  expanded?: boolean
  onChange?: (action: OBSToggleStreaming) => void
  onRemove?: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
}

const TargetString = {
  [ToggleTarget.Streaming]: "streaming",
  [ToggleTarget.Recording]: "recording",
  [ToggleTarget.ReplayBuffer]: "replay buffer",
}
const StartStopString = {
  [StartOrStop.Start]: "Start",
  [StartOrStop.Stop]: "Stop",
  [StartOrStop.Toggle]: "Toggle"
}

export const OBSToggleStreamingPill: React.SFC<IOBSToggleStreamingPill> = (props) => {
  const [ showBody, setExpanded ] = React.useState<boolean>(props.expanded);
  
  const setMode = (val: StartOrStop) => props.onChange(lodash.set(props.action, 'mode', val));
  const setTarget = (val: ToggleTarget) => props.onChange(lodash.set(props.action, 'target', val));

  const Expanded = (
    <Split direction="row">
      <Child
        grow
        whiteSpace="nowrap"
        padding="0 1rem 0 0"
      >
        <div
          style={{textOverflow: "ellipsis", overflow: "hidden"}}
        >
          OBS: {StartStopString[props.action.mode]} {TargetString[props.action.target]}
        </div>
      </Child>
    </Split>
  )

  return (
    <Pill
      isExpanded={showBody}
      icon={<Icon icon={OBS} />}
      expanded={Expanded}
      collapsed={Expanded}
      onRemove={() => props.onRemove(props.action.id)}
      onMoveUp={props.onMoveUp ? () => props.onMoveUp(props.action.id) : null}
      onMoveDown={props.onMoveDown ? () => props.onMoveDown(props.action.id) : null}
      onExpand={() => setExpanded(true)}
      onCollapse={() => setExpanded(false)}
    >
      <Split padding="0 0 1rem 0">
        <Row title="Mode:">
          <Select
            value={props.action.target}
            //@ts-ignore
            onChange={(e) => setTarget(e.target.value)}
          >
            <option value={ToggleTarget.Streaming}>Streaming</option>
            <option value={ToggleTarget.Recording}>Recording</option>
            <option value={ToggleTarget.ReplayBuffer}>Replay buffer</option>
          </Select>
        </Row>
        <Row title="Action:">
          <Select
            value={props.action.mode}
            //@ts-ignore
            onChange={(e) => setMode(e.target.value)}
          >
            <option value={StartOrStop.Start}>Start streaming</option>
            <option value={StartOrStop.Stop}>Stop streaming</option>
            <option value={StartOrStop.Toggle}>Toggle streaming</option>
          </Select>
        </Row>
      </Split>
    </Pill>
  )
}

OBSToggleStreamingPill.defaultProps = {
  expanded: false,
  onChange: () => {},
  onRemove: () => {},
}