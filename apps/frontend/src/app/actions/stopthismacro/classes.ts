import { v4 as uuid } from 'uuid';
import { ActionType, Action } from '..';

import { Serializable } from 'typescript-json-serializer';

@Serializable()
export class StopThisMacro extends Action {
  constructor(id: string = uuid()) {
    super(ActionType.StopThisMacro, id);
  }
}