import * as React from 'react';

import { AnimatePresence, motion } from 'framer-motion';
import { PillBorder, PillHeader } from './components'

interface IPill {
  isExpanded: boolean
  icon: JSX.Element,
  expanded: JSX.Element,
  collapsed: JSX.Element,
  expandable?: boolean
  onMoveUp: (e: React.MouseEvent<HTMLButtonElement>) => void,
  onMoveDown: (e: React.MouseEvent<HTMLButtonElement>) => void,
  onRemove: (e: React.MouseEvent<HTMLButtonElement>) => void,
  onCollapse: (e: React.MouseEvent<HTMLButtonElement>) => void,
  onExpand: (e: React.MouseEvent<HTMLButtonElement>) => void,
}

export const Pill: React.SFC<IPill> = (props) => {
  const [ isExpanded, setIsExpanded ] = React.useState<boolean>(props.isExpanded);
  return (
    <PillBorder show={isExpanded}>
      <PillHeader
        isExpanded={isExpanded}
        icon={props.icon}
        expanded={props.expanded}
        expandable={props.expandable}
        collapsed={props.collapsed}
        onMoveUp={props.onMoveUp}
        onMoveDown={props.onMoveDown}
        onRemove={props.onRemove}
        onCollapse={() => setIsExpanded(false)}
        onExpand={() => setIsExpanded(true)}
      />
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            key="content"
            transition={{
              type: 'spring',
              damping: 60,
              stiffness: 400
            }}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {props.children}
          </motion.div>
        )}
      </AnimatePresence>
    </PillBorder>
  )
}

Pill.defaultProps = {
  expandable: true
}