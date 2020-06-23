import * as React from 'react';

import { Split, Select, Child, IconButton, Switch, Input, Textarea } from '@lunchpad/base';

import { LaunchpadButtonLookTextComponent, LaunchpadButtonLookImageComponent, LaunchpadButtonSolidColorComponent, LaunchpadButtonFlashingColorComponent, LaunchpadButtonPulsingColorComponent, LaunchpadButtonRGBColorComponent } from './partials';
import { Divider, Row } from '../Settings/components';
import { ActionEditor } from '../ActionEditor';
import { ButtonDown, Icon, ButtonUp } from '@lunchpad/icons';
import { LaunchpadButton } from '@lunchpad/types';

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