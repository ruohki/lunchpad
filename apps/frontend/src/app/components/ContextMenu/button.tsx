import React from 'react';

import { Icon, Pen, PageCopy, PagePaste, Cut, Trash } from '@lunchpad/icons';

import { MenuParent, MenuItem, MenuDivider } from '@lunchpad/base'

interface IMenu {
  x: number
  y: number
  onSelect: (x: number, y: number, key: string, value: string | number | object | undefined) => void
  onClose: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void
}

export default ({ x, y, onSelect, onClose }) => {
  return (
    <MenuParent
      onClick={(e, id) => {
        e.stopPropagation();
        onSelect(x, y, id, undefined)
        onClose(e)
      }}
    >
      <MenuItem id="editButton"><Icon icon={Pen} />Edit button...</MenuItem>
      <MenuDivider />
      <MenuItem id="copyButton"><Icon icon={PageCopy} />Copy button</MenuItem>
      <MenuItem id="pasteButton"><Icon icon={PagePaste} />Paste button</MenuItem>
      <MenuItem id="cutButton"><Icon icon={Cut} />Cut button</MenuItem>
      <MenuDivider />
      <MenuItem id="clearButton"><Icon icon={Trash} />Clear button</MenuItem>
    </MenuParent>
  )
}