import { StopThisMacro } from '@lunchpad/types';
import { MacroAction } from './index';

// This is not handled in the macro engine itself
export class StopThisMacroAction extends MacroAction {
  constructor(action: StopThisMacro) {
    super()
    this.id = action.id;
  }
}