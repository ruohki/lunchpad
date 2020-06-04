import { Delay } from '@lunchpad/types';
import { MacroAction } from './index';

export class DelayAction extends MacroAction {
  private action: Delay;
  private cancel: boolean = false;

  constructor(action: Delay) {
    super()
    this.action = action;
    this.id = action.id;
    this.wait = action.wait;
  }

  public async Run(): Promise<unknown> {
    return new Promise(resolve => {
      const handle = setTimeout(resolve, this.action.delay)
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