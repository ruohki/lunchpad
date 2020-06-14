import { PushToTalkStart, PushToTalkEnd } from '@lunchpad/types';
import { MacroAction } from './index';
import { MacroRunner } from '../engine';

export class PushToTalkStartAction extends MacroAction {
  private action: PushToTalkStart;
  private cancel: boolean = false;
  private runner: MacroRunner;

  constructor(action: PushToTalkStart) {
    super()
    this.action = action;
    this.id = action.id;
    this.wait = action.wait;
  }

  public async Run(runner: MacroRunner): Promise<unknown> {
    this.runner = runner;
    return new Promise(resolve => {
      runner.emit('onPushToTalkStart');

      resolve()
    })
  }

  public Stop() {
    this.cancel = true;
  }
}

export class PushToTalkEndAction extends MacroAction {
  private action: PushToTalkEnd;
  private cancel: boolean = false;
  private runner: MacroRunner;

  constructor(action: PushToTalkEnd) {
    super()
    this.action = action;
    this.id = action.id;
    this.wait = action.wait;
  }

   public async Run(runner: MacroRunner): Promise<unknown> {
    this.runner = runner;
    return new Promise(resolve => {
      runner.emit('onPushToTalkEnd');
      
      resolve()
    })
  }

  public Stop() {
    this.cancel = true;
  }
}