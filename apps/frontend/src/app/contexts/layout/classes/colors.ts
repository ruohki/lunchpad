import { JsonProperty, Serializable } from 'typescript-json-serializer';
import { RGBIndexPalette } from '@lunchpad/types';

export const hexToRgb = (hex: string): {r: number, g: number, b: number} =>  {
  if(/^#([a-f0-9]{3}){1,2}$/.test(hex)){
      if(hex.length== 4){
          hex= '#'+[hex[1], hex[1], hex[2], hex[2], hex[3], hex[3]].join('');
      }
      let c = parseInt('0x'+hex.substring(1));
      return { r: (c>>16)&255, g: (c>>8)&255, b: c&255 }
  }
}

export type LaunchpadButtonColor = LaunchpadSolidButtonColor | LaunchpadFlashingButtonColor | LaunchpadPulsingButtonColor | LaunchpadRGBButtonColor;

@Serializable()
export class LaunchpadButtonColorBase {
  // 0 = Static, 1 = Flashing, 2 = Pulsing, 3 = RGB
  @JsonProperty()
  public mode: LaunchpadButtonColorMode;

  constructor(mode: LaunchpadButtonColorMode) {
    this.mode = mode
  }

  public static RandomIndex(): number {
    return Math.floor(Math.random() * 128);
  }

  public getRGB(): { r: number, g: number, b: number } { return {r: 0, g: 0, b: 0}}
}

@Serializable()
export class LaunchpadSolidButtonColor extends LaunchpadButtonColorBase {
  // will be an index
  @JsonProperty()
  public color: number;

  constructor(color: number) {
    super(LaunchpadButtonColorMode.Static);
    this.color = color;
  }

  public getRGB(): { r: number, g: number, b: number } {
    return hexToRgb(RGBIndexPalette[this.color]);
  }
}

@Serializable()
export class LaunchpadFlashingButtonColor extends LaunchpadButtonColorBase {
  @JsonProperty()
  public color: number;
  
  @JsonProperty()
  public alt: number;

  constructor(color: number, alt: number) {
    super(LaunchpadButtonColorMode.Flashing);
    this.color = color;
    this.alt = alt;
  }

  public getRGB(): { r: number, g: number, b: number } {
    return hexToRgb(RGBIndexPalette[this.color]);
  }

  public getRGBAlt(): { r: number, g: number, b: number } {
    return hexToRgb(RGBIndexPalette[this.alt]);
  }
}

@Serializable()
export class LaunchpadPulsingButtonColor extends LaunchpadButtonColorBase {
  @JsonProperty()
  public color: number;

  constructor(color: number) {
    super(LaunchpadButtonColorMode.Pulsing);
    this.color = color;
  }

  public getRGB(): { r: number, g: number, b: number } {
    return hexToRgb(RGBIndexPalette[this.color]);
  }
}

@Serializable()
export class LaunchpadRGBButtonColor extends LaunchpadButtonColorBase {
  @JsonProperty()
  public color: string;

  constructor(color: string) {
    super(LaunchpadButtonColorMode.RGB);
    this.color = color;
  }

  public getRGB(): { r: number, g: number, b: number } {
    return hexToRgb(this.color);
  }

  public static RandomRGB(): string {
    return `#${Math.floor(Math.random() * 256).toString(16).padStart(2,"0")}${Math.floor(Math.random() * 256).toString(16).padStart(2,"0")}${Math.floor(Math.random() * 256).toString(16).padStart(2,"0")}`
  }
}



export enum LaunchpadButtonColorMode {
  Static = 0,
  Flashing = 1,
  Pulsing = 2,
  RGB = 3,
}