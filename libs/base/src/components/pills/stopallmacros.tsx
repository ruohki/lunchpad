import * as React from 'react';
import * as _ from 'lodash';

import { StopAllMacros } from '@lunchpad/types';
import { IconEdit, IconTimes, IconCheck, IconTrash, IconUp, IconDown, IconTrafficLightStop } from '@lunchpad/icons';

import { PillHeader, PillBorder } from './pill'
import { Split, Child, VerticalPipe, Row } from '../basic/layout';
import { IconButton, Tooltip, Input } from '../basic';
import { COLOR_REDISH, COLOR_BLURPLE } from '../../theme';

type MoveFN = (id: string) => void

interface IStopAllMacrosPill {
  action: StopAllMacros
  expanded?: boolean
  onChange?: (action: StopAllMacros) => void
  onRemove?: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
}

export const StopAllMacrosPill: React.SFC<IStopAllMacrosPill> = ({ action, expanded, onChange, onRemove, onMoveUp, onMoveDown }) => {
  const [ showBody, setExpanded ] = React.useState<boolean>(expanded);

  return (
    <PillBorder show={showBody}>
      <PillHeader expanded={showBody}>
        <Split direction="row">
          <Child padding={"0 1rem 0 0"}><IconTrafficLightStop /></Child>
          {showBody ? <>
            <Child grow whiteSpace="nowrap"><div style={{textOverflow: "ellipsis", overflow: "hidden"}}>Edit: Stop all running macros</div></Child>
            <Child padding="0">
              <Tooltip title="Removes the action from the list! ITS GONE!" >
                <IconButton hover={COLOR_REDISH} onClick={() => onRemove(action.id)} icon={<IconTrash />} />
              </Tooltip>
            </Child>
            <Child padding="0 0 0 2rem">
              <Tooltip title="Discard changes made to this action" >
                <IconButton hover={COLOR_REDISH} onClick={() => setExpanded(false)} icon={<IconTimes />} />
              </Tooltip>
            </Child>
          </> : <>
            <Child grow whiteSpace="nowrap"><div style={{textOverflow: "ellipsis", overflow: "hidden"}}>Stop all running macros</div></Child>
            <Child padding="0"><IconButton disabled={!onMoveUp} icon={<IconUp />} onClick={() => onMoveUp(action.id)} /></Child>
            <Child padding="0 0 0 1rem"><IconButton disabled={!onMoveDown} icon={<IconDown />} onClick={() => onMoveDown(action.id)} /></Child>
            <Child padding="0 1rem 0 1rem"><VerticalPipe /></Child>
            <Child padding="0"><IconButton onClick={() => setExpanded(true)} icon={<IconEdit />} /></Child>
          </>}
        </Split>
      </PillHeader>
    </PillBorder>
  )
}

StopAllMacrosPill.defaultProps = {
  expanded: false,
  onChange: () => {},
  onRemove: () => {},
}