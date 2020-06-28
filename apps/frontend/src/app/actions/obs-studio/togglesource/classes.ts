import { v4 as uuid } from 'uuid';
import { ActionType, Action } from '../../';

import { JsonProperty, Serializable } from 'typescript-json-serializer';
import { IOBSStudioContext } from '../../../contexts/obs-studio';

@Serializable()
export class OBSToggleSource extends Action {
  @JsonProperty()
  public sceneName: string;
  
  @JsonProperty()
  public collectionName: string;
  
  @JsonProperty()
  public sourceName: string
  
  @JsonProperty()
  public visible: boolean

  private cancel: boolean;
  private OBSStudio: Partial<IOBSStudioContext>

  constructor(sceneName: string, collectionName: string, sourceName: string = "", visible: boolean = false, id: string = uuid()) {
    super(ActionType.OBSToggleSource, id);
    this.sceneName = sceneName;
    this.collectionName = collectionName;
    this.sourceName = sourceName;
    this.visible = visible;
  }

  setOBSContext = (obsContext: Partial<IOBSStudioContext>) => this.OBSStudio = obsContext;

  public async Run(): Promise<unknown> {
    if (this.OBSStudio.currentCollection !== this.collectionName) {
      await this.OBSStudio.switchActiveSceneCollection(this.collectionName);
    }
    return this.OBSStudio.setItemVisiblity(this.sourceName, this.sceneName, this.visible);
  }

  public Stop() {
    this.cancel = true;
  }
}