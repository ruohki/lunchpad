import * as React from 'react';

import clamp from 'lodash/clamp';
import range from 'lodash/range';
import reverse from 'lodash/reverse';

import { lighten } from 'polished';

import Button from '../../ControllerButton'

import { Layout } from './components';
import { store as controllerConfigurationContext } from '../../Provider/controllerConfigurationStore'

import { XYToButton } from './helper'
import { RGBColor } from '@lunchpad/types';

import { faCaretUp, faCaretDown, faCaretLeft, faCaretRight } from '@fortawesome/free-solid-svg-icons';
import { faCircle, faChevronRight } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';

import { ipcChannels as ipc } from '@lunchpad/types'
const { ipcRenderer } = window.require('electron');

interface LaunchpadProps {
  onContextMenu: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>, id: number) => void
}

const Launchpad: React.SFC<LaunchpadProps> = ({ onContextMenu }) => {
  const { pages, activePage, updateButton  } = React.useContext(controllerConfigurationContext)
  const buttons = pages.get(activePage);
  
  const UpRow = [
    <Icon icon={faCaretUp} />,
    <Icon icon={faCaretDown} />,
    <Icon icon={faCaretLeft} />,
    <Icon icon={faCaretRight} />,
    <span>Session<br />Mixer</span>,
    <span>Note</span>,
    <span>Custom</span>,
    <span style={{ fontSize: "1rem"}}><Icon style={{ fontSize: "2.5rem" }} icon={faCircle} /><br />Capture MIDI</span>,
  ]

  const RightRow = [
    <span style={{ fontSize: "1rem"}}><Icon style={{ fontSize: "2.5rem" }} icon={faChevronRight} /><br />Volume</span>,
    <span style={{ fontSize: "1rem"}}><Icon style={{ fontSize: "2.5rem" }} icon={faChevronRight} /><br />Pan</span>,
    <span style={{ fontSize: "1rem"}}><Icon style={{ fontSize: "2.5rem" }} icon={faChevronRight} /><br />Send A</span>,
    <span style={{ fontSize: "1rem"}}><Icon style={{ fontSize: "2.5rem" }} icon={faChevronRight} /><br />Send B</span>,
    <span style={{ fontSize: "1rem"}}><Icon style={{ fontSize: "2.5rem" }} icon={faChevronRight} /><br />Stop Clip</span>,
    <span style={{ fontSize: "1rem"}}><Icon style={{ fontSize: "2.5rem" }} icon={faChevronRight} /><br />Mute</span>,
    <span style={{ fontSize: "1rem"}}><Icon style={{ fontSize: "2.5rem" }} icon={faChevronRight} /><br />Solo</span>,
    <span style={{ fontSize: "1rem"}}><Icon style={{ fontSize: "2.5rem" }} icon={faChevronRight} /><br />Record Arm</span>,
  ]
  return (
    <Layout>
      {reverse(range(0, 9)).map((y) => range(0,9).map((x) => {
        const button = buttons.get(XYToButton(x,y));
        let color = "#f1f1f1";
        const [r, g, b] = button?.spec;
        
        const luminance =  (((0.2126*(r * 4)) + (0.7152*(g * 4)) + (0.0722* (b* 4))) / 255) || 0.1
        color = `rgb(${clamp(r * 4, 255)},${clamp(g * 4, 255)}, ${clamp(b * 4, 255)})`
        if (luminance <= 0.1) {
          color = lighten((1 / Math.sinh(luminance)) / 50, `rgb(${clamp(r * 4, 255)},${clamp(g * 4, 255)}, ${clamp(b * 4, 255)})`)
        }
        return XYToButton(x,y) !== 99 ? (
          <Button
            color={button.state !== "pressed" ? color : "#1f1f1"}
            keyId={button.buttonId}
            key={`${x}${y}`}
            clip={x === 8 || y === 8}
            onContextMenu={onContextMenu}
           
          >
            { x === 8 || y === 8 ? x === 8 ? RightRow[7 - y] : UpRow[x] : button.label }
          </Button>
        ) : (
          <Button
            key="settings"
            keyId={99}
            color={"#6a45ff"}
            round
            onContextMenu={() => true}
          >
            SET
          </Button>
        )
      }
      ))}
    </Layout>
  )
}

export default Launchpad;