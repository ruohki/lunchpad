import React, { useState } from 'react';

import { COLOR_BLACK, Split, Child, Outer, Button, Divider, Tab } from '@lunchpad/base';

import General from './general';
import Pages from './pages';
import About from './about';
import { Connections } from './connections';

const Settings = ({ onClose }) => {
  const [ activeTab, setTab ] = useState<number>(0);

  return (
    <Outer height="100%">
      <Split height="100%">
        <Child>
          <Split direction="row" width="100%" backgroundColor={COLOR_BLACK}>
            <Child>
              <Tab active={activeTab === 0} title="Settings"  onClick={() => setTab(0)}  />
            </Child>
            <Child>
              <Tab active={activeTab === 1} title="Pages" onClick={() => setTab(1)} />
            </Child>
            <Child>
              <Tab active={activeTab === 2} title="Connections" onClick={() => setTab(2)} />
            </Child>
            <Child>
              <Tab active={activeTab === 3} title="About..." onClick={() => setTab(3)} />
            </Child>
          </Split>
        </Child>
        {activeTab === 0 && <General />}
        {activeTab === 1 && <Pages />}
        {activeTab === 2 && <Connections />}
        {activeTab === 3 && <About />}
        <Split padding="0 1rem 1rem 1rem">
          <Child basis="0">
            <Divider />
          </Child>
        </Split>
        <Split direction="row" justify="flex-end" >
          <Child margin="0 1rem 1rem 1rem" basis="0">
            <Button onClick={onClose}>Close</Button>
          </Child>
        </Split>
      </Split>
    </Outer>
  )
}

export default Settings