import { Delay, SetColor, LaunchpadButtonColor } from '@lunchpad/types';
import { MacroAction } from './index';

export class SetColorAction extends MacroAction {
  private action: SetColor;
  private setColor: (color: LaunchpadButtonColor) => void

  constructor(action: SetColor, setColor: (color: LaunchpadButtonColor) => void ) {
    super()
    this.action = action;
    this.id = action.id;
    this.wait = action.wait;
    this.setColor = setColor
  }

  public async Run(): Promise<unknown> {
    return this.setColor(this.action.color);
  }

  public Stop() {}
}