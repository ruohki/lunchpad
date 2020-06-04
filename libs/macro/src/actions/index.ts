import { v4 as uuid } from 'uuid';

export class MacroAction {
  public id: string = uuid();
  public wait: boolean = true;

  public async Run(): Promise<unknown> {
    return;
  }

  public Stop(): void {}
}