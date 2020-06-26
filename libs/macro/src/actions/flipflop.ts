import { FlipFlopStart, FlipFlopMiddle, FlipFlopEnd } from '@lunchpad/types';
import { MacroAction } from './index';
import { MacroRunner } from '../engine';

export class FlipFlopStartAction extends MacroAction {
  public action: FlipFlopStart;
  private cancel: boolean = false;
  private runner: MacroRunner;

  constructor(action: FlipFlopStart) {
    super()
    this.action = action;
    this.id = action.id;
    this.wait = action.wait;
  }

  public async Run(runner: MacroRunner): Promise<unknown> {
    return true;
  }

  public Stop() {
    this.cancel = true;
  }
}

export class FlipFlopMiddleAction extends MacroAction {
  public action: FlipFlopMiddle;
  private cancel: boolean = false;
  private runner: MacroRunner;

  constructor(action: FlipFlopMiddle) {
    super()
    this.action = action;
    this.id = action.id;
    this.wait = action.wait;
  }

  public async Run(runner: MacroRunner): Promise<unknown> {
    return true;
  }

  public Stop() {
    this.cancel = true;
  }
}

export class FlipFlopEndAction extends MacroAction {
  public action: FlipFlopEnd;
  private cancel: boolean = false;
  private runner: MacroRunner;

  constructor(action: FlipFlopEnd) {
    super()
    this.action = action;
    this.id = action.id;
    this.wait = action.wait;
  }

  public async Run(runner: MacroRunner): Promise<unknown> {
    return true;
  }

  public Stop() {
    this.cancel = true;
  }
}