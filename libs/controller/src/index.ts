import { Page, ControllerType } from '@lunchpad/types';

export * from './helper';

export * from './launchpadx';
export * from './launchpadminimk3';
export * from './launchpadmk2';
export * from './launchpadpromk2';
export * from './launchpads';

export * from './software6x6';

export interface IPoint {
  x: number
  y: number
}

export interface IPadProps {
  showIcons: boolean
  activePage: Page
  onSettingsButtonClick: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void
  buttonProps: {
    onMouseDown: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>, x: number, y: number, note: number, cc: boolean) => void
    onMouseUp: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>, x: number, y: number, note: number, cc: boolean) => void
    onContextMenu: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>, x: number, y: number, note: number) => void
    onDrop: (target: any, payload: any, modifier) => void
    onDragStart?: (x: number, y: number) => void
    onDragEnd?: (x: number, y: number, modifier: string) => void
    onDraggedWithoutModifier?: () => void
  }
}

export interface IPad {
  name: string
  type: ControllerType
  initialize: (send: (code: number[], data: number[]) => void) => void
  unload: (send: (code: number[], data: number[]) => void) => void
  buildColors: (send: (code: number[], data: number[]) => void, page: Page, activeButtons: Array<{x: number, y: number}>) => void
  XYToButton: (x: number, y: number) => number
  ButtonToXY: (button: number, cc?: boolean) => [number, number]
  Component: React.SFC<IPadProps>
  limitedColor: boolean
};