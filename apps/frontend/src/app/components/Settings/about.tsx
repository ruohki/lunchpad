import React from 'react';
import { v4 as uuid } from 'uuid';

import { logo, Split, Child, LinkButton, ScrollBox } from '@lunchpad/base'
import { Divider } from './components';
import { useSettings } from '@lunchpad/hooks';
import { settingsLabels } from '@lunchpad/types';

export default () => {
  const [ userId ] = useSettings(settingsLabels.debug.userId, uuid());

  return (
    <Child grow padding="1rem" >
      <ScrollBox>

      
      <Split direction="row">
        <Child align="flex-start">
          <img width={128} height={128} src={logo} alt="Lunchpad" />
        </Child>
        
        <Child grow align="flex-start" >
          <Split >
            <Child text="center">
              <h1>Lunchpad</h1>
              <h5>(c) 2020 by Tillmann Hübner (<LinkButton href="mailto:ruohki@gmail.com">ruohki@gmail.com</LinkButton>)</h5>
            </Child>
            <Child padding="1rem">
              <Divider />
            </Child>
            <Child padding="0 1rem 1rem 1rem">
              <p>This software is distributed under the ISC License and is free of any charge. If you paid money for it - you got ripped off.</p>
              <br />
              <p>All product and company names are trademarks™ or registered® trademarks of their respective holders. Use of them does not imply any affiliation with or endorsement by them.</p>
              <p>All specifications are subject to change without notice.</p>
              <p>Launchpad is a trademark of Focusrite-Novation</p>
              <br />
              <p>You can grab a copy of this Software on Discord.</p>
              <LinkButton href="https://discord.gg/4Ys9TRR">https://discord.gg/4Ys9TRR</LinkButton>
            </Child>
            <Child padding="0 1rem 1rem 1rem">
              <p>If you are sending metrics this is the id to identify you</p>
              AppID: {userId}
            </Child>
          </Split>
        </Child>
      </Split>
      </ScrollBox>
    </Child>
  )
}