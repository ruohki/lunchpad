import { v4 as uuid } from 'uuid';
import { ActionType, Action } from '..';
import { LaunchpadSolidButtonColor, LaunchpadFlashingButtonColor, LaunchpadPulsingButtonColor, LaunchpadRGBButtonColor, ColorPredicate } from '../../contexts/layout/classes';

import { JsonProperty, Serializable } from 'typescript-json-serializer';

type LaunchpadButtonColor = LaunchpadSolidButtonColor | LaunchpadFlashingButtonColor | LaunchpadPulsingButtonColor | LaunchpadRGBButtonColor;



@Serializable()
export class SetColor extends Action {
  @JsonProperty()
  public color: LaunchpadSolidButtonColor | LaunchpadFlashingButtonColor | LaunchpadPulsingButtonColor | LaunchpadRGBButtonColor;
  
  private setColor: (color: LaunchpadButtonColor) => void

  constructor(color: LaunchpadButtonColor = new LaunchpadSolidButtonColor(12), id: string = uuid()) {
    super(ActionType.SetColor, id);
    this.color = color;
  }

  setColorFunction = (fn: (color: LaunchpadButtonColor) => void) => this.setColor = fn;

  public async Run(): Promise<unknown> {
    return this.setColor(this.color);
  }

  public Stop() {}
}