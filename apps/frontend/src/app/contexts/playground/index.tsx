import * as React from 'react';
import { OBSStudioContext } from '../obs-studio';

export const Playground: React.SFC = (props) => {
  
  return (
    <div>
      {props.children}
    </div>
  )
}