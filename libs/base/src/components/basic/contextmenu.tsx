
import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';

interface IMenuParent {
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
`

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
`

export const MenuDivider = styled.hr`
  margin: .5rem .5rem .5rem .5rem;
  border: 1px solid var(--COLOR_ALMOSTBLACK);
`