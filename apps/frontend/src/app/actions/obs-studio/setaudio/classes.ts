import { v4 as uuid } from 'uuid';
import { ActionType, Action } from '../../';

import { JsonProperty, Serializable } from 'typescript-json-serializer';
import { IOBSStudioContext } from '../../../contexts/obs-studio';

@Serializable()
export class OBSToggleMixer extends Action {
  @JsonProperty()
  public sceneName: string;
  
  @JsonProperty()
  public collectionName: string;
  
  @JsonProperty()
  public sourceName: string
  
  @JsonProperty()
  public muted: boolean

  @JsonProperty()
  public volume: number

  private cancel: boolean;
  private OBSStudio: Partial<IOBSStudioContext>

  constructor(sceneName: string, collectionName: string, sourceName: string = "", muted: boolean = false, volume: number = 1, id: string = uuid()) {
    super(ActionType.OBSToggleMixer, id);
    this.sceneName = sceneName;
    this.collectionName = collectionName;
    this.sourceName = sourceName;
    this.muted = muted;
    this.volume = volume;
  }

  setOBSContext = (obsContext: Partial<IOBSStudioContext>) => this.OBSStudio = obsContext;

  public async Run(): Promise<unknown> {
    if (this.OBSStudio.currentCollection !== this.collectionName) {
      await this.OBSStudio.switchActiveSceneCollection(this.collectionName);
    }
    await this.OBSStudio.setMute(this.sourceName, this.muted);
    return this.OBSStudio.setVolume(this.sourceName, this.volume);
  }

  public Stop() {
    this.cancel = true;
  }
}