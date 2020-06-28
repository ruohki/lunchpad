import { v4 as uuid } from 'uuid';
import { ActionType, Action } from '..';

import { Serializable } from 'typescript-json-serializer';

@Serializable()
export class StopAllMacros extends Action {
  constructor(id: string = uuid()) {
    super(ActionType.StopAllMacros, id);
  }
}