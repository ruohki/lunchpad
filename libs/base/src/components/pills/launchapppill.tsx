import * as React from 'react';
import * as lodash from 'lodash';

import { LaunchApp } from '@lunchpad/types';
import { IconEdit, IconTimes, IconCheck, IconTrash, IconUp, IconDown, IconTerminal } from '@lunchpad/icons';

import { PillHeader, PillBorder } from './pill'
import { Split, Child, VerticalPipe, Row } from '../basic/layout';
import { IconButton, Tooltip, Input, Switch, File } from '../basic';
import { COLOR_REDISH, COLOR_BLURPLE } from '../../theme';

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

  const [ executable, setExecutable ] = React.useState<string>(action.executable);
  const [ args, setArguments ] = React.useState<string>(action.arguments);
  const [ hidden, setHidden ] = React.useState<boolean>(action.hidden)
  
  const [ wait, setWait ] = React.useState<boolean>(action.wait)
  const [ kill, setKill ] = React.useState<boolean>(action.killOnStop)

  const change = () => {
    const actn = new LaunchApp(executable, args, hidden, kill, action.id)
    onChange(actn)
    setExpanded(false);
  }

  return (
    <PillBorder show={showBody}>
      <PillHeader expanded={showBody}>
        <Split direction="row">
          <Child padding={"0 1rem 0 0"}><IconTerminal /></Child>
          {showBody ? <>
            <Child grow width="40%" whiteSpace="nowrap"><div style={{textOverflow: "ellipsis", overflow: "hidden"}}>Edit: Launch application</div></Child>
            <Child padding="0">
              <Tooltip title="Removes the action from the list! ITS GONE!" >
                <IconButton hover={COLOR_REDISH} onClick={() => onRemove(action.id)} icon={<IconTrash />} />
              </Tooltip>
            </Child>
            <Child padding="0 0 0 2rem">
              <Tooltip title="Update this action with the current settings" >
                <IconButton hover={COLOR_BLURPLE} onClick={change} icon={<IconCheck />} />
              </Tooltip>
            </Child>
            <Child padding="0 0 0 2rem">
              <Tooltip title="Discard changes made to this action" >
                <IconButton hover={COLOR_REDISH} onClick={() => setExpanded(false)} icon={<IconTimes />} />
              </Tooltip>
            </Child>
          </> : <>
          <Child grow width="50%" whiteSpace="nowrap"><div style={{textOverflow: "ellipsis", overflow: "hidden"}}>Launch: {executable}</div></Child>
            <Child padding="0"><IconButton disabled={!onMoveUp} icon={<IconUp />} onClick={() => onMoveUp(action.id)} /></Child>
            <Child padding="0 0 0 1rem"><IconButton disabled={!onMoveDown} icon={<IconDown />} onClick={() => onMoveDown(action.id)} /></Child>
            <Child padding="0 1rem 0 1rem"><VerticalPipe /></Child>
            <Child padding="0"><IconButton onClick={() => setExpanded(true)} icon={<IconEdit />} /></Child>
          </>}
        </Split>
      </PillHeader>
      {showBody && <Split direction="column" padding="1rem">
        <Child>
          <Split>
            <Row title="">
              <Split direction="row">
                <Child padding="0 1rem 0 0">
                  <Switch
                    value={wait}
                    onChange={setWait}
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
                    value={hidden}
                    onChange={setHidden}
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
                    value={kill}
                    onChange={setKill}
                  />
                </Child>
                <Child grow>
                  <span>Kill when macro gets stopped</span>
                </Child>
              </Split>
            </Row>
            <Row title="App:">
              <File editable value={executable} accept="application/*" onChange={setExecutable} />
            </Row>
            <Row title="Arguments:">
              <Input value={args} onChange={e => setArguments(e.target.value)} />
            </Row>
          </Split>
        </Child>
      </Split>}
    </PillBorder>
  )
}

LaunchAppPill.defaultProps = {
  expanded: false,
  onChange: () => {},
  onRemove: () => {},
}