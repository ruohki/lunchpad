import 'reflect-metadata';
import { JsonProperty, Serializable } from 'typescript-json-serializer';



@Serializable()
export class LaunchpadButtonLookBase {
  @JsonProperty()
  public type: LaunchpadButtonLookType

  constructor(type: LaunchpadButtonLookType) {
    this.type = type;
  }
}

@Serializable()
export class LaunchpadButtonLookText extends LaunchpadButtonLookBase {
  @JsonProperty()
  public caption: string;

  @JsonProperty()
  public size: number;

  @JsonProperty()
  public face: string;

  @JsonProperty()
  public color: string;

  constructor(caption: string, size = 16, face = "Exo 2", color = "#ffffff") {
    super(LaunchpadButtonLookType.Text);
    this.caption = caption;
    this.size = size;
    this.face = face;
    this.color = color;
  }
}

@Serializable()
export class LaunchpadButtonLookImage extends LaunchpadButtonLookBase {
  @JsonProperty()
  public uri: string;

  constructor(uri: string) {
    super(LaunchpadButtonLookType.Image)
    this.uri = uri;
  }
}

export type LaunchpadButtonLook = LaunchpadButtonLookText | LaunchpadButtonLookImage

export enum LaunchpadButtonLookType {
  Text = 0,
  Image = 1
}