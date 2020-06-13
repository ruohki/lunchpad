import * as React from 'react';
import styled from 'styled-components';
import { COLOR_MENU, COLOR_REDISH } from '../../../theme/colors';
import { darken, lighten } from 'polished';
import { Child, Split, IconButton, VerticalPipe } from '../../basic';

import { Action } from '@lunchpad/types';
import { Icon, ArrowUp, ArrowDown, Trash, ChevronDown } from '@lunchpad/icons';

export interface IPill {
  expanded?: boolean
  action: Action
  component: any
}

interface IPillBorder {
  show: boolean
}

interface IPillHeader {
  isExpanded?: boolean
  expandable?: boolean
  icon: JSX.Element,
  expanded: JSX.Element,
  collapsed: JSX.Element,
  onMoveUp: (e: React.MouseEvent<HTMLButtonElement>) => void,
  onMoveDown: (e: React.MouseEvent<HTMLButtonElement>) => void,
  onRemove: (e: React.MouseEvent<HTMLButtonElement>) => void,
  onCollapse: (e: React.MouseEvent<HTMLButtonElement>) => void,
  onExpand: (e: React.MouseEvent<HTMLButtonElement>) => void,
}

const PillHeaderSFC: React.SFC<IPillHeader> = ({ children, expanded, expandable, collapsed, icon, onMoveUp, onMoveDown, onRemove, onCollapse, onExpand, ...rest }) => {
  return (
    <Child {...rest}>
      <Split direction="row">
        <Child padding={"0 1rem 0 0"}>{icon}</Child>
        <Child grow>
          {rest.isExpanded ? expanded : collapsed}
        </Child>
        {(onMoveUp || onMoveDown) && <Child padding="0 1rem 0 1rem"><VerticalPipe /></Child>}
        {onMoveUp && <Child padding="0"><IconButton icon={<Icon icon={ArrowUp} />} onClick={onMoveUp} /></Child>}
        {(onMoveUp && onMoveDown) && <Child padding="0 1rem 0 0" />}
        {onMoveDown && <Child padding="0"><IconButton icon={<Icon icon={ArrowDown} />} onClick={onMoveDown} /></Child>}
        <Child padding="0 1rem 0 1rem"><VerticalPipe /></Child>
        <Child padding="0"><IconButton hover={COLOR_REDISH} onClick={onRemove} icon={<Icon icon={Trash} />} /></Child>
        {expandable && <Child padding="0 1rem 0 1rem"><VerticalPipe /></Child>}
        {expandable && <Child padding="0">
          <IconButton onClick={rest.isExpanded ? onCollapse : onExpand} icon={<Icon icon={ChevronDown} />} rotation={rest.isExpanded ? 0 : 180} />
        </Child>}
      </Split>
    </Child>
  )
}

const PillHover = `
  &:hover {
    cursor: pointer;
    background-color: ${darken(0.02, COLOR_MENU)};
  }
`

export const PillHeader = styled(PillHeaderSFC)<IPillHeader>`
  padding: 1rem;
  background-color: ${props => darken(props.isExpanded ? 0.02 : 0.01, COLOR_MENU)};
  ${props => !props.isExpanded ? PillHover : ''}
`

export const PillBorder = styled(Split)<IPillBorder>`
  border: 2px solid ${props => darken(props.show ? 0.02 : 0.01, COLOR_MENU)};
  border-radius: 8px;
  overflow: hidden;

  &:hover {
    border-color: ${darken(0.02, COLOR_MENU)};
  }
`

PillBorder.defaultProps = {
  margin: "0 0 1rem 0"
}

export const PillBody = styled(Child)`
  padding: 1rem;
  border-radius: 0 0 8px 8px;
  background-color: ${lighten(0.03, COLOR_MENU)};
`