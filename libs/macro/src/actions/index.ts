import { v4 as uuid } from 'uuid';
import { MacroRunner } from '../engine';

export class MacroAction {
  public id: string = uuid();
  public wait: boolean = true;

  public async Run(runner: MacroRunner): Promise<unknown> {
    return;
  }

  public Stop(): void {}
}