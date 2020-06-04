import React from 'react';

import { IconEdit, IconCopy, IconPaste, IconCut } from '@lunchpad/icons';

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
      <MenuItem id="editButton"><IconEdit />Edit button...</MenuItem>
      <MenuDivider />
      <MenuItem disabled id="copyButton"><IconCopy />Copy button</MenuItem>
      <MenuItem disabled id="pasteButton"><IconPaste />Paste button</MenuItem>
      <MenuItem disabled id="cutButton"><IconCut />Cut button</MenuItem>
      <MenuDivider />
      <MenuItem id="clearButton">Clear button...</MenuItem>
    </MenuParent>
  )
}