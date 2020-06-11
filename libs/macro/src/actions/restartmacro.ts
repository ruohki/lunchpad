import { RestartThisMacro } from '@lunchpad/types';
import { MacroAction } from './index';

// This is not handled in the macro engine itself
export class RestartThisMacroAction extends MacroAction {
  constructor(action: RestartThisMacro) {
    super()
    this.id = action.id;
  }
}