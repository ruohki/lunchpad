import * as React from 'react';
import { Icon, PageOpen, Trash, PageCopy, PageAdd, PagePaste } from '@lunchpad/icons';

import { Split, Child, Row, Input, IconButton, COLOR_REDISH, Tooltip } from '@lunchpad/base'
import Pill from '../../../actions/pill';

interface IPage {
  id: string
  name: string
}

interface IPagePill {
  page: IPage
  onSwitch: () => void
  onClone: () => void
  onExport: () => void
  onImport: () => void
  expanded?: boolean
  onChange?: (name: string) => void
  onRemove?: () => void
}

export const PagePill: React.SFC<IPagePill> = (props) => {
  const [ showBody, setExpanded ] = React.useState<boolean>(props.expanded);

  const Expanded = (
    <Split direction="row">
      <Child grow whiteSpace="nowrap" padding="0 1rem 0 0"><div style={{textOverflow: "ellipsis", overflow: "hidden"}}>{props.page.name}</div></Child>
    </Split>
  )

  return (
    <Pill
      isExpanded={showBody}
      icon={<IconButton onClick={props.onSwitch} icon={<Icon icon={PageOpen}/>} />}
      expanded={Expanded}
      collapsed={Expanded}
      onRemove={null}
      onMoveUp={null}
      onMoveDown={null}
      onExpand={() => setExpanded(true)}
      onCollapse={() => setExpanded(false)}
    >
      <Split padding="0 0 1rem 0">
        <Row title="Page:">
          <Input
            value={props.page.name}
            onChange={(e) => props.onChange(e.target.value)}
          />
        </Row>
        <Row title="">
          <Split direction="row" padding="0 0.5rem 0 1rem">
            {props.onClone && <Child padding="0 1rem 0 0">
              <Tooltip
                title="Will create a copy of the page"
              >
                <IconButton onClick={props.onClone} icon={<Icon icon={PageAdd} />}>Duplicate</IconButton>
              </Tooltip>
            </Child>}
            {props.onExport && <Child padding="0 1rem 0 0">
              <Tooltip
                title="Export the whole page to your clipboard"
              >
                <IconButton onClick={props.onExport} icon={<Icon icon={PageCopy} />}>Export</IconButton>
              </Tooltip>
            </Child>}
            {props.onImport && <Child padding="0 1rem 0 0">
              <Tooltip
                title="Try to overwrite this page with a configuration in your clipboard"
              >
                <IconButton onClick={props.onImport} icon={<Icon icon={PagePaste} />}>Import</IconButton>
              </Tooltip>
            </Child>}
            <Child grow></Child>
            {props.onRemove && <Child padding="0 1rem 0 0">
              <IconButton hover={COLOR_REDISH} onClick={props.onRemove} icon={<Icon icon={Trash} />}>Remove</IconButton>
            </Child>}
          </Split>
        </Row>
      </Split>
    </Pill>
  )
}

PagePill.defaultProps = {
  expanded: false,
  onChange: () => {},
}