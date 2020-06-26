import * as React from 'react';
import * as lodash from 'lodash';

import { LaunchApp } from '@lunchpad/types';
import { Icon, Shell } from '@lunchpad/icons';

import { Pill } from './pill'
import { Split, Child, Row } from '../basic/layout';
import { Switch, File, Input } from '../basic';

interface ILaunchAppPill {
  action: LaunchApp
  expanded?: boolean
  onChange?: (action: LaunchApp) => void
  onRemove?: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
}

export const LaunchAppPill: React.SFC<ILaunchAppPill> = ({ action, expanded, onChange, onRemove, onMoveUp, onMoveDown }) => {
  const [ showBody, setExpanded ] = React.useState<boolean>(expanded);

  const setProp = (props) => {
    onChange(Object.assign({}, action, props))
  }

  const Expanded = (
    <Split direction="row">
      <Child grow whiteSpace="nowrap" padding="0 1rem 0 0"><div style={{textOverflow: "ellipsis", overflow: "hidden"}}>Launch: {lodash.truncate(action.executable, { length: 45})}</div></Child>
    </Split>
  )
  
  return (
    <Pill
      isExpanded={showBody}
      icon={<Icon icon={Shell} />}
      expanded={Expanded}
      collapsed={Expanded}
      onRemove={() => onRemove(action.id)}
      onMoveUp={onMoveUp ? () => onMoveUp(action.id) : null}
      onMoveDown={onMoveDown ? () => onMoveDown(action.id) : null}
      onExpand={() => setExpanded(true)}
      onCollapse={() => setExpanded(false)}
    >
      <Split padding="0 0 1rem 0">
        <Row title="">
          <Split direction="row">
            <Child padding="0 1rem 0 0">
              <Switch
                value={action.wait}
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
                value={action.hidden}
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
                value={action.killOnStop}
                onChange={killOnStop => setProp({ killOnStop })}
              />
            </Child>
            <Child grow>
              <span>Kill when macro gets stopped</span>
            </Child>
          </Split>
        </Row>
        <Row title="App:">
          <File editable value={action.executable} accept="application/*" onChange={executable => setProp({ executable })} />
        </Row>
        <Row title="Arguments:">
          <Input value={action.arguments} onChange={e => setProp({ arguments: e.target.value })} />
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