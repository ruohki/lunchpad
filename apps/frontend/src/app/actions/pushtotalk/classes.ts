import { v4 as uuid } from 'uuid';
import { ActionType, PairedAction } from '..';
import { settingsLabels } from '@lunchpad/types';

const robotjs = window.require('robotjs');

import { JsonProperty, Serializable } from 'typescript-json-serializer';
import { MacroRunner } from '../../contexts/macro/runner';

@Serializable()
export class PushToTalkStart extends PairedAction {
  @JsonProperty()
  public endId: string;

  private runner: MacroRunner;
  private cancel: boolean = false;

  constructor(id: string = uuid()) {
    super(ActionType.PushToTalkStart, id);
  }

  public async Run(runner: MacroRunner): Promise<unknown> {
    this.runner = runner;
    return new Promise(resolve => {
      runner.emit('onPushToTalkStart');
      setTimeout(resolve, 250)
    })
  }

  public Stop() {
    this.cancel = true;
  }
}

@Serializable()
export class PushToTalkEnd extends PairedAction {
  @JsonProperty()
  public startId: string;

  private runner: MacroRunner;
  private cancel: boolean = false;

  constructor(startId: string, id: string = uuid()) {
    super(ActionType.PushToTalkEnd, id);
    this.startId = startId;
  }

  public async Run(runner: MacroRunner): Promise<unknown> {
    this.runner = runner;
    return new Promise(resolve => {
      runner.emit('onPushToTalkEnd');
      setTimeout(resolve, 250)
    })
  }

  public Stop() {
    this.cancel = true;
  }
}



function tryParse(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export class PushToTalk {
  private isPushed: boolean = false
  
  private keyPressed: string;
  private modifiers: string[];
  
  public Push() {
    if (!this.isPushed) {
      const key = localStorage.getItem(settingsLabels.ptt.key);
      const modifier: string[] = tryParse(localStorage.getItem(settingsLabels.ptt.modifier)) ?? [];
      this.isPushed = true;
      this.keyPressed = key;
      this.modifiers = modifier;

      robotjs.keyToggle(key, "down", modifier);
      
      //console.log("Pressed PTT")
    }
  }

  public Release() {
    if (this.isPushed) {
      this.isPushed = false;
      robotjs.keyToggle(this.keyPressed, "up", this.modifiers);
      //console.log("Released PTT")
    }
  }
}