
import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { ChevronDown, Icon, ChevronUp } from '@lunchpad/icons';
import { Split, Child } from './layout';
import { IconButton } from './button';
import { COLOR_MENU } from '../../theme';
import { darken } from 'polished';

interface IMenuParent {
  height?: number
  onClick: (event: React.MouseEvent<HTMLDivElement, MouseEvent>, id: string) => void
}

export const MenuParent = styled(({ children, onClick, ...rest }) => (
    <div {...rest}>{React.Children.map(children, (child, index) => (
      React.cloneElement(child, {
        onClick: (e) => onClick(e, child.props.id || index)
      })
    ))}
    </div>
  )
)<IMenuParent>`
  display: flex;
  flex-direction: column;
  padding: 0;
  margin-bottom: 2px;
  padding: 1rem 0;
  max-height: ${props => props.height};
`

MenuParent.defaultProps = {
  height: 'unset'
}

interface IMenuItem {
  id: string
}

export const MenuItem = styled(({ children, ...rest}) => (
  <motion.div {...rest}>{children}</motion.div>
))<IMenuItem>`
  padding: 1rem 2.5rem;
  white-space: nowrap;
  transition: background-color 0.1s ease;

  &:hover {
    background-color: var(--COLOR_BLURPLE);
  }

  svg {
    max-width: 20px;
    margin-right: 2rem;
  }
  
  ${IconButton} svg {
    margin-right: 0 !important;
  }
  
`

export const MenuDivider = styled.hr`
  margin: .5rem .5rem .5rem .5rem;
  border: 1px solid var(--COLOR_ALMOSTBLACK);
`

interface IMenuGroupComponent {
  expanded?: boolean
  header: JSX.Element
}

const MenuGroupContainer = styled.div`
  svg {
    max-width: 20px;
    margin-right: 2rem;
  }


`

const MenuGroupChildContainer = styled(motion.div)<{ expanded: boolean }>`
  height: ${props => props.expanded ? 'auto' : '0px'};
  overflow: hidden;
  box-shadow: inset 0px 10px 10px -10px rgba(0,0,0,0.35), inset 0px -10px 10px -10px rgba(0,0,0,0.35);
  ${MenuItem} {
    background-color: ${darken(0.05, COLOR_MENU)};
    &:hover {
      background-color: var(--COLOR_BLURPLE);
    }
    cursor: pointer;
  }

  
`

export const MenuGroup: React.SFC<IMenuGroupComponent> = (props) => {
  const [ isExpanded, setExpanded ] = React.useState<boolean>(props.expanded)

  return (
    <MenuGroupContainer>
      <MenuItem onClick={(e) => {
        e.stopPropagation();
        setExpanded(!isExpanded)
      }}>
        <Split direction="row" >
          <Child grow>{props.header}</Child>
          <Child padding={"0 1rem 0 0"}>
            <IconButton icon={<Icon icon={ChevronDown} />} rotation={isExpanded ? 0 : -90} />
          </Child>
        </Split>
      </MenuItem>
      <MenuGroupChildContainer
        initial={{ height: isExpanded ? "auto" : "0px" }}
        animate={{ height: isExpanded ? "auto" : "0px" }}
        expanded={isExpanded}
      >
        {props.children}
      </MenuGroupChildContainer>
    </MenuGroupContainer>
  )
}

MenuGroup.defaultProps = {
  expanded: true
}