import * as React from 'react';

import {
  Split,
  Child,
  Tooltip,
  IconButton,
  PillList,
  Outer,
  Row,
  Input,
  Switch,
  Button,
  COLOR_GREYPLE,
  COLOR_BLURPLE,
  COLOR_MENU
} from '@lunchpad/base';
import { useLocalStorage } from '@lunchpad/hooks';
import { settingsLabels } from '@lunchpad/types';
import { OBSStudioContext } from '../../../contexts/obs-studio';

export const OBSStudio = () => {
  const { connect, isConnected }= React.useContext(OBSStudioContext.Context);
  
  const [enabled, setEnabled] = useLocalStorage<boolean>(
    settingsLabels.connections.obsStudio.enabled,
    false
  );
  const [address, setAddress] = useLocalStorage<string>(
    settingsLabels.connections.obsStudio.address,
    'localhost:4444'
  );
  const [password, setPassword] = useLocalStorage<string>(
    settingsLabels.connections.obsStudio.password,
    '',
  );
  const [autoConnect, setAutoConnect] = useLocalStorage<boolean>(
    settingsLabels.connections.obsStudio.autoConnect,
    false
  );

  return (
    <Child grow>
      <Row title="Enable OBS-Studio">
        <Split direction="row">
          <Child padding="0 1rem 0 0">
            <Switch value={enabled} onChange={setEnabled} />
          </Child>
          <Child grow>
            <span>integration requires obs-websocket-plugin</span>
          </Child>
        </Split>
      </Row>
      <Row title="Auto connect">
        <Split direction="row">
          <Child padding="0 1rem 0 0">
            <Switch value={autoConnect} onChange={setAutoConnect} />
          </Child>
          <Child grow>
            <span>automaticly connect to obs-studio</span>
          </Child>
        </Split>
      </Row>
      <Row title="URL:">
        <Input value={address} onChange={e => setAddress(e.target.value)} />
      </Row>
      {!autoConnect && (<Row title="Status:">
        <Split direction="row">
          <Child grow>
            <p>{isConnected ? 'connected to obs-websocket' : 'not connected to obs-websocket'}</p>
          </Child>
          <Child padding="0 0.5rem 0 1rem">
            <Button color={isConnected ? COLOR_MENU : COLOR_BLURPLE} padding="0 1rem 0 1rem" disabled={isConnected}  onClick={connect}>Connect...</Button>
          </Child>
        </Split>
      </Row>)}
      <Row title="Password:">
        <Input
          type="password"
          value={password}
          onChange={e => {
            setEnabled(false);
            setPassword(e.target.value);
          }}
        />
      </Row>
    </Child>
  );
};
