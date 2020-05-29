import * as React from 'react';
import List, { ListItem } from '../basic/list';
import { Split, Child, IconButton, Tooltip } from '../basic';
import { IconPlus } from '@lunchpad/icons';

export const ActionList = () => {

  return (
    <List menu={
      <Split direction={"row"}>
        <Child grow>
          Actions:
        </Child>
        <Child padding="1rem">
          <Tooltip
            title="Add an additional action to this button"
            >
            <IconButton icon={<IconPlus />} />
          </Tooltip>
        </Child>
      </Split>
    }>
      <ListItem>Volume: 100%</ListItem>
      <ListItem>Play soundfile</ListItem>
      <ListItem>Play soundfile</ListItem>
      <ListItem>Play soundfile</ListItem>
      <ListItem>Play soundfile</ListItem>
      <ListItem>Volume: 80%</ListItem>
    </List>
  )
}
