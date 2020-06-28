import * as React from 'react';

import {  Split, Child, Tooltip, IconButton, PillList, Outer } from '@lunchpad/base';
import { OBSStudio } from './obsstudio';

const { remote } = window.require('electron')

export const Connections = () => {
 
  return (
    <Child grow>
      <Split>
        <OBSStudio />
      </Split>
    </Child>
  )
}