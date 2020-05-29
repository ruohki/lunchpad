import * as React from 'react';
import ReactTooltip from "react-tooltip";

import { v4 as uuid } from 'uuid';

interface ITooltip {
  title: string
  delay?: number,
  active?: boolean,
  place?: 'top' | 'right' | 'bottom' | 'left'
  type?: 'dark' | 'success' | 'warning' | 'error' | 'info' | 'light'
}

export const Tooltip: React.SFC<ITooltip> = (props) => {
  const id = uuid();

  return props.active ? (
  <>
    <div data-tip data-for={id} >
      {props.children}
    </div>
    <ReactTooltip className={`tooltip`} delayShow={props.delay} id={id} place={props.place} type={props.type} effect="solid">
      {props.title}
    </ReactTooltip>
  </>
  ) : <>{props.children}</>
}

Tooltip.defaultProps = {
  title: "Tooltip missing.",
  active: true,
  delay: 500,
  place: 'top',
  type: 'info'
}