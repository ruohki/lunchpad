import * as React from 'react';
import HelmetComponent from 'react-helmet';

import * as Devices from './controller';
import { settingsLabels } from '@lunchpad/types';

import * as versionInfo from '../../../../version.json';
import { useSettings } from '@lunchpad/hooks';
import { LayoutContext } from './contexts/layout';

export const Helmet = () => {
  const { activePage } = React.useContext(LayoutContext.Context);
  const [ controller ] = useSettings(settingsLabels.controller, "Software6x6");
  
  const Launchpad = Devices[controller as string] as Devices.IPad

  return (
    <HelmetComponent>
      <title>Lunchpad {versionInfo.version} - {Launchpad.name} - {activePage.name}</title>
    </HelmetComponent>
  )
}