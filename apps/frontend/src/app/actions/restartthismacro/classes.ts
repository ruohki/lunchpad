import { v4 as uuid } from 'uuid';
import { ActionType, Action } from '..';

import { Serializable } from 'typescript-json-serializer';

@Serializable()
export class RestartThisMacro extends Action {
  constructor(id: string = uuid()) {
    super(ActionType.RestartThisMacro, id);
  }
}