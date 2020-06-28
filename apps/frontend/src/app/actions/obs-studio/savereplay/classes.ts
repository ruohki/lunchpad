
import { v4 as uuid } from 'uuid';
import { ActionType, Action } from '../../';
import { IOBSStudioContext } from '../../../contexts/obs-studio';

import { Serializable } from 'typescript-json-serializer';

@Serializable()
export class OBSSaveReplay extends Action {
  private cancel: boolean = false;
  private OBSStudio: Partial<IOBSStudioContext>

  constructor(id: string = uuid()) {
    super(ActionType.OBSSaveReplayBuffer, id);
  }

  setOBSContext = (obsContext: Partial<IOBSStudioContext>) => this.OBSStudio = obsContext;

  public async Run(): Promise<unknown> {
    return this.OBSStudio.saveReplay();
  }

  public Stop() {
    this.cancel = true;
  }
}