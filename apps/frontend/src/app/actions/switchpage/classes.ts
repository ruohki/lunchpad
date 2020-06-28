import { v4 as uuid } from 'uuid';
import { ActionType, Action } from '..';

import { JsonProperty, Serializable } from 'typescript-json-serializer';
import { settingsLabels } from '@lunchpad/types';

@Serializable()
export class SwitchPage extends Action {
  @JsonProperty()
  public pageId: string;

  constructor(pageId: string = "default", id: string = uuid()) {
    super(ActionType.SwitchPage, id);
    this.pageId = pageId;
  }

  public async Run(): Promise<unknown> {
    return localStorage.setItem(settingsLabels.layout.active, this.pageId);
  }
}