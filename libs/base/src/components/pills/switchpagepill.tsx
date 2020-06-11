import * as React from 'react';
import * as lodash from 'lodash';

import { SwitchPage } from '@lunchpad/types';
import { IconEdit, IconTimes, IconCheck, IconTrash, IconUp, IconDown, IconMap } from '@lunchpad/icons';

import { Pill } from './pill'
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
  const targetPage = lodash.find(pages, (p) => p.id === action.pageId) || pages[0];

  const setProp = (props) => {
    onChange(Object.assign({}, action, props))
  }

  const Expanded = (
    <Split direction="row">
      <Child grow whiteSpace="nowrap" padding="0 1rem 0 0"><div style={{textOverflow: "ellipsis", overflow: "hidden"}}>Switch page: {targetPage.name}</div></Child>
    </Split>
  )

  return (
    <Pill
      isExpanded={showBody}
      icon={<IconMap />}
      expanded={Expanded}
      collapsed={Expanded}
      onRemove={() => onRemove(action.id)}
      onMoveUp={onMoveUp ? () => onMoveUp(action.id) : null}
      onMoveDown={onMoveDown ? () => onMoveDown(action.id) : null}
      onExpand={() => setExpanded(true)}
      onCollapse={() => setExpanded(false)}
    >
      <Split padding="0 0 1rem 0">
        <Row title="Page:">
          <Select
            value={action.pageId}
            onChange={(e) => setProp({ pageId: e.target.value })}
          >
            {pages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Row>
      </Split>
    </Pill>
  )
}

SwitchPagePill.defaultProps = {
  expanded: false,
  onChange: () => {},
  onRemove: () => {},
}