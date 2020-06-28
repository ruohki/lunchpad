import { v4 as uuid } from 'uuid';
import { ActionType, Action } from '..';

import { JsonProperty, Serializable } from 'typescript-json-serializer';


@Serializable()
export class Delay extends Action {
  private cancel: boolean = false;

  @JsonProperty()
  public delay: number;

  constructor(delay: number = 1000, id: string = uuid()) {
    super(ActionType.Delay, id);
    this.delay = delay;
  }

  public async Run(): Promise<unknown> {
    return new Promise(resolve => {
      const handle = setTimeout(resolve, this.delay)
      const cancelIntervalHandle = setInterval(() => {
        if (this.cancel) {
          clearTimeout(handle)
          clearInterval(cancelIntervalHandle)
          resolve();
        }
      }, 1)
    })
  }

  public Stop() {
    this.cancel = true;
  }
}