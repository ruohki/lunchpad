import * as React from 'react';
import { render } from 'react-dom';
import { App } from './app';

import { ModalContext } from './components/layout/components/modal';

const ContextApp = () => (
  <ModalContext.Provider>
    <App />
  </ModalContext.Provider>
)

render(<ContextApp />, document.getElementById("root"));