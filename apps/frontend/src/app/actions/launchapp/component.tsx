import * as React from 'react';
import lodash from 'lodash';

import { Icon, Shell } from '@lunchpad/icons';
import { Split, Child, Row, Switch, File, Input  } from '@lunchpad/base';

import Pill from '../pill'
import { LaunchApp } from './classes';

interface ILaunchAppPill {
  action: LaunchApp
  expanded?: boolean
  onChange?: (action: LaunchApp) => void
  onRemove?: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
}

export const LaunchAppPill: React.SFC<ILaunchAppPill> = (props) => {
  const [ showBody, setExpanded ] = React.useState<boolean>(props.expanded);

  const setProp = (props) => {
    props.onChange(Object.assign({}, props.action, props))
  }

  const Expanded = (
    <Split direction="row">
      <Child grow whiteSpace="nowrap" padding="0 1rem 0 0"><div style={{textOverflow: "ellipsis", overflow: "hidden"}}>Launch: {lodash.truncate(props.action.executable, { length: 45})}</div></Child>
    </Split>
  )
  
  return (
    <Pill
      isExpanded={showBody}
      icon={<Icon icon={Shell} />}
      expanded={Expanded}
      collapsed={Expanded}
      onRemove={() => props.onRemove(props.action.id)}
      onMoveUp={props.onMoveUp ? () => props.onMoveUp(props.action.id) : null}
      onMoveDown={props.onMoveDown ? () => props.onMoveDown(props.action.id) : null}
      onExpand={() => setExpanded(true)}
      onCollapse={() => setExpanded(false)}
    >
      <Split padding="0 0 1rem 0">
        <Row title="">
          <Split direction="row">
            <Child padding="0 1rem 0 0">
              <Switch
                value={props.action.wait}
                onChange={wait => setProp({ wait })}
              />
            </Child>
            <Child grow>
              <span>Wait until application is closed / finished</span>
            </Child>
          </Split>
        </Row>
        <Row title="">
          <Split direction="row">
            <Child padding="0 1rem 0 0">
              <Switch
                value={props.action.hidden}
                onChange={hidden => setProp({ hidden })}
              />
            </Child>
            <Child grow>
              <span>Windowless if possible</span>
            </Child>
          </Split>
        </Row>
        <Row title="">
          <Split direction="row">
            <Child padding="0 1rem 0 0">
              <Switch
                value={props.action.killOnStop}
                onChange={killOnStop => setProp({ killOnStop })}
              />
            </Child>
            <Child grow>
              <span>Kill when macro gets stopped</span>
            </Child>
          </Split>
        </Row>
        <Row title="App:">
          <File editable value={props.action.executable} accept="application/*" onChange={executable => setProp({ executable })} />
        </Row>
        <Row title="Arguments:">
          <Input value={props.action.arguments} onChange={e => setProp({ arguments: e.target.value })} />
        </Row>
      </Split>
    </Pill>
  )
}

LaunchAppPill.defaultProps = {
  expanded: false,
  onChange: () => {},
  onRemove: () => {},
}