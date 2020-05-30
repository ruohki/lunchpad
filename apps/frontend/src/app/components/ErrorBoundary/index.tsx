import * as React from 'react';
import { Button, COLOR_REDISH, Split, Child, Tooltip } from '@lunchpad/base';
import { settingsLabels } from '@lunchpad/types';
import { NotificationContext } from '@lunchpad/contexts';

const { remote } = window.require('electron');

interface IErrorBoundary {
  hasError: boolean
}

export class ErrorBoundary extends React.Component<{}, IErrorBoundary> {
  static contextType = NotificationContext.Context

  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.log(error, errorInfo);
  }

  copyConfiguration() {
    const { addNotification } = this.context
    const config = localStorage.getItem(settingsLabels.layout);
    remote.clipboard.writeText(config);
    addNotification("Your current configuration has been copied to your clipboard.", 2500)
  }

  resetConfiguration() {
    localStorage.clear();
    window.location.reload();
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <>
          <Split  justify="center">
            <Child text="center" padding="0 0 3rem 0" align="center">
              <h1>OH NO! Something went wrong.</h1>
              <p>You may have a look at the developer console.<br/>To open it press Ctrl+Shift+I or Cmd+Option+I</p>
            </Child>
            <Child padding="0 0 5rem 0" width="auto">
              <Tooltip delay={50} title="Copy your current configuration to your clipboard. Helpful for errorfinding or manual debugging.">
              <Button onClick={this.copyConfiguration.bind(this)}>Copy configuration to clipboard</Button>
              </Tooltip>
            </Child>

            <Child width="auto" align="center">
              <Tooltip delay={50} type="error" title="Absolute danger Zone! Will reset the whole application to factory defaults">
                <Button color={COLOR_REDISH} onClick={this.resetConfiguration.bind(this)}>Reset everything</Button>
              </Tooltip>
            </Child>
          </Split>
        </>
      )
    }

    return this.props.children; 
  }
}