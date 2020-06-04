import * as React from 'react';
import * as _ from 'lodash';

import { Delay } from '@lunchpad/types';
import { IconEdit, IconTimes, IconCheck, IconTrash, IconUp, IconDown, IconStopwatch } from '@lunchpad/icons';

import { PillHeader, PillBorder } from './pill'
import { Split, Child, VerticalPipe, Row } from '../basic/layout';
import { IconButton, Tooltip, Input } from '../basic';
import { COLOR_REDISH, COLOR_BLURPLE } from '../../theme';

type MoveFN = (id: string) => void

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
  const [ delay, setDelay ] = React.useState<number>(action.delay);

  const change = () => {
    const actn = new Delay(
      delay,
      action.id
    )
    onChange(actn)
    setExpanded(false);
  }

  return (
    <PillBorder show={showBody}>
      <PillHeader expanded={showBody}>
        <Split direction="row">
          <Child padding={"0 1rem 0 0"}><IconStopwatch /></Child>
          {showBody ? <>
            <Child grow width="40%" whiteSpace="nowrap"><div style={{textOverflow: "ellipsis", overflow: "hidden"}}>Edit: Delay</div></Child>
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
            <Child grow width="50%" whiteSpace="nowrap"><div style={{textOverflow: "ellipsis", overflow: "hidden"}}>Delay: {delay}ms</div></Child>
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
            <Row title="Delay:">
              <Split direction="row">
                  <Child grow padding="0 1rem 0 0">
                    <Input value={delay} onChange={e => {
                      setDelay(Math.round(parseInt(e.target.value)) || 0)
                    }} />
                  </Child>
                  <Child>
                    <span style={{ whiteSpace: "nowrap"}}>milliseconds (ms)</span>
                  </Child>
                </Split>
              
            </Row>
          </Split>
        </Child>
      </Split>}
    </PillBorder>
  )
}

DelayPill.defaultProps = {
  expanded: false,
  onChange: () => {},
  onRemove: () => {},
}