import { v4 as uuid } from 'uuid';
import { ActionType, TripleAction } from '..';

import { JsonProperty, Serializable } from 'typescript-json-serializer';
import { MacroRunner } from '../../contexts/macro/runner';

@Serializable()
export class FlipFlopStart extends TripleAction {
  @JsonProperty()
  public endId: string;

  @JsonProperty()
  public middleId: string;

  @JsonProperty()
  public isA: boolean;

  private cancel: boolean;

  constructor(id: string = uuid()) {
    super(ActionType.FlipFlopStart, id);
    this.isA = true;
  }

  public async Run(runner: MacroRunner): Promise<unknown> {
    return true;
  }

  public Stop() {
    this.cancel = true;
  }
}

@Serializable()
export class FlipFlopMiddle extends TripleAction {
  @JsonProperty()
  public startId: string;

  @JsonProperty()
  public endId: string;

  private cancel: boolean;

  constructor(startId: string, id: string = uuid()) {
    super(ActionType.FlipFlopMiddle, id);
    this.startId = startId;
  }

  public async Run(runner: MacroRunner): Promise<unknown> {
    return true;
  }

  public Stop() {
    this.cancel = true;
  }
}

@Serializable()
export class FlipFlopEnd extends TripleAction {
  @JsonProperty()
  public startId: string;
  
  @JsonProperty()
  public middleId: string;

  private cancel: boolean;

  constructor(startId: string, middleId: string, id: string = uuid()) {
    super(ActionType.FlipFlopEnd, id);
    this.startId = startId;
    this.middleId = middleId;
  }

  public async Run(runner: MacroRunner): Promise<unknown> {
    return true;
  }

  public Stop() {
    this.cancel = true;
  }
}