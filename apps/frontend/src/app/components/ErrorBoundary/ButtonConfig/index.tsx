import * as React from 'react';
import { Button, COLOR_REDISH, Split, Child, Tooltip, COLOR_GREENISH } from '@lunchpad/base';
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

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <>
          <Split  justify="center">
            
          </Split>
        </>
      )
    }

    return this.props.children;
  }
}