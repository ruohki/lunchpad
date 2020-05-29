import { Page } from '@lunchpad/types';
import { Output } from 'webmidi';

export * from './launchpadminimk3';
export * from './launchpadmk2';

export interface ILaunchpad {
  buildColors: (output: Output, page: Page) => void
  Name: string
  ColorFromRGB: (color: {[key: string]: number}) => [number, number, number]
  Vendor: number[]
  Mode: number[]
  Color: number[]
  XYToButton: (x: number, y: number) => number
  ButtonToXY: (button: number) => [number, number]
  Component: JSX.Element
};