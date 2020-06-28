import * as React from 'react';

import { Split, Divider, Row, Child, IconButton, Switch, Input, Textarea } from '@lunchpad/base';
import { LaunchpadButton } from '../../contexts/layout/classes';

interface IImportExport {
  button: LaunchpadButton
  onChangeButton(loop: LaunchpadButton): void
}

//TODO: Finish me

export const ImportExport: React.SFC<IImportExport> = (props) => {
  
  const base64 = btoa(JSON.stringify(props.button));
  return (
    <Split direction="column" width="100%">
      <Child padding="0 1rem 0 0">
        <Textarea value={base64} />
      </Child>
    </Split>
  )
}