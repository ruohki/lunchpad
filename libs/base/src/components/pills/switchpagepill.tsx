import * as React from 'react';
import * as lodash from 'lodash';

import { SwitchPage } from '@lunchpad/types';
import { IconEdit, IconTimes, IconCheck, IconTrash, IconUp, IconDown, IconMap } from '@lunchpad/icons';

import { PillHeader, PillBorder } from './pill'
import { Split, Child, VerticalPipe, Row } from '../basic/layout';
import { IconButton, Tooltip, Select } from '../basic';
import { COLOR_REDISH, COLOR_BLURPLE } from '../../theme';

interface IPage {
  id: string
  name: string
}

type MoveFN = (id: string) => void

interface ISwitchPagePill {
  action: SwitchPage
  pages: IPage[]
  expanded?: boolean
  onChange?: (action: SwitchPage) => void
  onRemove?: (id: string) => void
  onMoveUp: MoveFN | undefined
  onMoveDown: MoveFN | undefined
}

export const SwitchPagePill: React.SFC<ISwitchPagePill> = ({ action, pages, expanded, onChange, onRemove, onMoveUp, onMoveDown }) => {
  const [ showBody, setExpanded ] = React.useState<boolean>(expanded);
  const [ pageId, setPageId ] = React.useState<string>(action.pageId);

  const targetPage = lodash.find(pages, (p) => p.id === pageId) || pages[0];

  const change = () => {
    const actn = new SwitchPage(
      pageId,
      action.id
    )
    onChange(actn)
    setExpanded(false);
  }

  return (
    <PillBorder show={showBody}>
      <PillHeader expanded={showBody}>
        <Split direction="row">
          <Child padding={"0 1rem 0 0"}><IconMap /></Child>
          {showBody ? <>
            <Child grow width="40%" whiteSpace="nowrap"><div style={{textOverflow: "ellipsis", overflow: "hidden"}}>Edit: Switch Page</div></Child>
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
            <Child grow width="50%" whiteSpace="nowrap"><div style={{textOverflow: "ellipsis", overflow: "hidden"}}>Switch Page: {targetPage.name}</div></Child>
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
            <Row title="Page:">
              <Select
                value={pageId}
                onChange={(e) => setPageId(e.target.value)}
              >
                {pages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Row>
          </Split>
        </Child>
      </Split>}
    </PillBorder>
  )
}

SwitchPagePill.defaultProps = {
  expanded: false,
  onChange: () => {},
  onRemove: () => {},
}