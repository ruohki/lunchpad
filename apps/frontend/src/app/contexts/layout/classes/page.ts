import { v4 as uuid } from 'uuid';
import lodash from 'lodash';
import { JsonProperty, Serializable, deserialize } from 'typescript-json-serializer';

import { LaunchpadButton } from './button'

@Serializable()
export class Page {
  @JsonProperty()
  public name: string;

  @JsonProperty({ 
    onDeserialize: (buttons: Record<number, Record<number, LaunchpadButton>>, data: Page) => lodash.mapValues(buttons, e => lodash.mapValues(e, button => deserialize<LaunchpadButton>(button, LaunchpadButton)))
  })
  public buttons: Record<number, Record<number, LaunchpadButton>>;

  @JsonProperty()
  public id: string;

  constructor(name: string = "", id: string = uuid()) {
    this.name = name;
    this.id = id;
    this.buttons = {}
  }
}
