import { Page, ControllerType, Button } from '@lunchpad/types';
import { Output } from 'webmidi';

export * from './launchpadx';
export * from './launchpadminimk3';
export * from './launchpadmk2';
export * from './launchpads';

export * from './software6x6';

export interface IPoint {
  x: number
  y: number
}
export interface IPadProps {
  activePage: Page
  onButtonPressed: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>, x: number, y: number, note: number, cc: boolean) => void
  onContextMenu: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>, x: number, y: number, note: number) => void
  onSettingsButtonClick: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void
  onDrop: (target: any, payload: any) => void
}

export interface IPad {
  buildColors: (output: Output, page: Page) => void
  name: string
  type: ControllerType
  ColorFromRGB: (color: {[key: string]: number}) => [number, number, number]
  XYToButton: (x: number, y: number) => number
  ButtonToXY: (button: number, cc: boolean) => [number, number]
  Component: React.SFC<IPadProps>
  limitedColor: boolean
};