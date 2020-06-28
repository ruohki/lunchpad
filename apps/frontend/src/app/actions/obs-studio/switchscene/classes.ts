
import { v4 as uuid } from 'uuid';
import { ActionType, Action } from '../../';
import { IOBSStudioContext } from '../../../contexts/obs-studio';

import { JsonProperty, Serializable } from 'typescript-json-serializer';

@Serializable()
export class OBSSwitchScene extends Action {
  @JsonProperty()
  public sceneName: string;

  @JsonProperty()
  public collectionName: string;

  private cancel: boolean = false;
  private OBSStudio: Partial<IOBSStudioContext>

  constructor(name: string, collection: string, id: string = uuid()) {
    super(ActionType.OBSSwitchScene, id);
    this.sceneName = name;
    this.collectionName = collection;
  }

  setOBSContext = (obsContext: Partial<IOBSStudioContext>) => this.OBSStudio = obsContext;

  public async Run(): Promise<unknown> {
    if (this.OBSStudio.currentCollection !== this.collectionName) {
      await this.OBSStudio.switchActiveSceneCollection(this.collectionName);
    }
    return this.OBSStudio.switchActiveScene(this.sceneName);
  }

  public Stop() {
    this.cancel = true;
  }
}