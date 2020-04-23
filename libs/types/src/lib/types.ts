import { Colorspec } from './ipc';

export * from './ipc';
export * from './ipcChannels';

export const SYSEX_HEADER = [ 0, 32, 41, 2, 12 ];

export const SYSEX_COLOR = [...SYSEX_HEADER, 3];


export type ButtonState = 'pressed' | 'released';

export type ControllerType = 'Software' | 'Novation Launchpad'

export type ControllerModelSoftware = 'Launchpad MK2' | 'Lunchpad X'
export type ControllerModelNovation = 'Launchpad MK2' | 'Lunchpad X'

export interface ButtonConfiguration {
  // MIDI Note to identify the button on the actual hardware
  buttonId?: number

  // Label that is present on the button in the UI
  label?: string

  state?: ButtonState

  spec?: Colorspec
}

export interface ControllerConfigurationStoreProps {
  controllerType: ControllerType
  controllerModel: ControllerModelSoftware | ControllerModelNovation

  activePage: string,
  pages: Map<string, Map<number, ButtonConfiguration>>

  buttons: Map<number, ButtonConfiguration>

  createPage?(name: string): boolean
  deletePage?(name: string): boolean
  activatePage?(name: string): boolean
  updateButton?(pageId: string, id: number, config: ButtonConfiguration): void
}