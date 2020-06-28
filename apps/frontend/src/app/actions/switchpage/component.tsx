import * as React from 'react';
import lodash from 'lodash';

import { Icon, PageOpen } from '@lunchpad/icons';

import Pill from '../pill'
import { Split, Child, Row, Select } from '@lunchpad/base';
import { SwitchPage } from './classes';

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

export const SwitchPagePill: React.SFC<ISwitchPagePill> = (props) => {
  const [ showBody, setExpanded ] = React.useState<boolean>(props.expanded);
  const targetPage = lodash.find(props.pages, (p) => p.id === props.action.pageId) || props.pages[0];

  const setProp = (props) => {
    props.onChange(Object.assign({}, props.action, props))
  }

  const Expanded = (
    <Split direction="row">
      <Child grow whiteSpace="nowrap" padding="0 1rem 0 0"><div style={{textOverflow: "ellipsis", overflow: "hidden"}}>Switch page: {targetPage.name}</div></Child>
    </Split>
  )

  return (
    <Pill
      isExpanded={showBody}
      icon={<Icon icon={PageOpen} />}
      expanded={Expanded}
      collapsed={Expanded}
      onRemove={() => props.onRemove(props.action.id)}
      onMoveUp={props.onMoveUp ? () => props.onMoveUp(props.action.id) : null}
      onMoveDown={props.onMoveDown ? () => props.onMoveDown(props.action.id) : null}
      onExpand={() => setExpanded(true)}
      onCollapse={() => setExpanded(false)}
    >
      <Split padding="0 0 1rem 0">
        <Row title="Page:">
          <Select
            value={props.action.pageId}
            onChange={(e) => setProp({ pageId: e.target.value })}
          >
            {props.pages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
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