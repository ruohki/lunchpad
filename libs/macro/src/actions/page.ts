import { SwitchPage, settingsLabels } from '@lunchpad/types';
import { MacroAction } from './index';

export class SwitchPageAction extends MacroAction {
  private action: SwitchPage;

  constructor(action: SwitchPage) {
    super()
    this.action = action;
    this.id = action.id;
    this.wait = true;
  }

  public async Run(): Promise<unknown> {
    return localStorage.setItem(settingsLabels.layout.active, this.action.pageId);
  }
}