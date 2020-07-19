import { v4 as uuid } from 'uuid';
import { ActionType, Action } from '../../';
import { IOBSStudioContext } from '../../../contexts/obs-studio';

import { Serializable, JsonProperty } from 'typescript-json-serializer';

@Serializable()
export class OBSToggleFilter extends Action {
  @JsonProperty()
  public sourceName: string
  
  @JsonProperty()
  public filterName: string

  @JsonProperty()
  public toggle: boolean

  private cancel: boolean = false;
  private OBSStudio: Partial<IOBSStudioContext>

  constructor(sourceName: string = "", filterName: string = "", toggle: boolean = false, id: string = uuid()) {
    super(ActionType.OBSToggleFilter, id);
    this.sourceName = sourceName;
    this.filterName = filterName;
    this.toggle = toggle;
  }

  setOBSContext = (obsContext: Partial<IOBSStudioContext>) => this.OBSStudio = obsContext;

  public async Run(): Promise<unknown> {
    return this.OBSStudio.setFilterVisibility(this.sourceName, this.filterName, this.toggle);
  }

  public Stop() {
    this.cancel = true;
  }
}