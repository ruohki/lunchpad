import { StopAllMacros } from '@lunchpad/types';
import { MacroAction } from './index';

// This is not handled in the macro engine itself
export class StopAllMacrosAction extends MacroAction {
  constructor(action: StopAllMacros) {
    super()
    this.id = action.id;
  }
}