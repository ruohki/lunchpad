import { Action } from '../classes';
import { RGBIndexPalette } from '../palettes';

export const hexToRgb = (hex: string): {r: number, g: number, b: number} =>  {
  if(/^#([a-f0-9]{3}){1,2}$/.test(hex)){
      if(hex.length== 4){
          hex= '#'+[hex[1], hex[1], hex[2], hex[2], hex[3], hex[3]].join('');
      }
      let c = parseInt('0x'+hex.substring(1));
      return { r: (c>>16)&255, g: (c>>8)&255, b: c&255 }
  }
}



export enum LaunchpadButtonColorMode {
  Static = 0,
  Flashing = 1,
  Pulsing = 2,
  RGB = 3,
}

class LaunchpadButtonColorBase {
  // 0 = Static, 1 = Flashing, 2 = Pulsing, 3 = RGB
  public mode: LaunchpadButtonColorMode;

  constructor(mode: LaunchpadButtonColorMode) {
    this.mode = mode
  }

  public static RandomIndex(): number {
    return Math.floor(Math.random() * 128);
  }

  public getRGB(): { r: number, g: number, b: number } { return {r: 0, g: 0, b: 0}}
}

export class LaunchpadSolidButtonColor extends LaunchpadButtonColorBase {
  // will be an index
  public color: number;

  constructor(color: number) {
    super(LaunchpadButtonColorMode.Static);
    this.color = color;
  }

  public static getRGB(color: LaunchpadSolidButtonColor): { r: number, g: number, b: number } {
    return hexToRgb(RGBIndexPalette[color.color]);
  }
}

export class LaunchpadFlashingButtonColor extends LaunchpadButtonColorBase {
  public color: number;
  public alt: number;

  constructor(color: number, alt: number) {
    super(LaunchpadButtonColorMode.Flashing);
    this.color = color;
    this.alt = alt;
  }

  public static getRGB(color: LaunchpadFlashingButtonColor): { r: number, g: number, b: number } {
    return hexToRgb(RGBIndexPalette[color.color]);
  }

  public static getRGBAlt(color: LaunchpadFlashingButtonColor): { r: number, g: number, b: number } {
    return hexToRgb(RGBIndexPalette[color.alt]);
  }
}

export class LaunchpadPulsingButtonColor extends LaunchpadButtonColorBase {
  public color: number;

  constructor(color: number) {
    super(LaunchpadButtonColorMode.Pulsing);
    this.color = color;
  }

  public static getRGB(color: LaunchpadPulsingButtonColor): { r: number, g: number, b: number } {
    return hexToRgb(RGBIndexPalette[color.color]);
  }
}

export class LaunchpadRGBButtonColor extends LaunchpadButtonColorBase {
  public color: string;

  constructor(color: string) {
    super(LaunchpadButtonColorMode.RGB);
    this.color = color;
  }

  public static getRGB(color: LaunchpadRGBButtonColor): { r: number, g: number, b: number } {
    return hexToRgb(color.color);
  }

  public static RandomRGB(): string {
    return `#${Math.floor(Math.random() * 256).toString(16).padStart(2,"0")}${Math.floor(Math.random() * 256).toString(16).padStart(2,"0")}${Math.floor(Math.random() * 256).toString(16).padStart(2,"0")}`
  }
}

export type LaunchpadButtonColor = LaunchpadSolidButtonColor | LaunchpadFlashingButtonColor | LaunchpadPulsingButtonColor | LaunchpadRGBButtonColor;

export enum LaunchpadButtonLookType {
  Text,
  Image
}

export class LaunchpadButtonLookBase {
  public type: LaunchpadButtonLookType

  constructor(type: LaunchpadButtonLookType) {
    this.type = type;
  }
}

export class LaunchpadButtonLookText extends LaunchpadButtonLookBase {
  public caption: string;
  public size: number;
  public face: string;
  public color: string;

  constructor(caption: string, size = 16, face = "Exo 2", color = "#ffffff") {
    super(LaunchpadButtonLookType.Text);
    this.caption = caption;
    this.size = size;
    this.face = face;
    this.color = color;
  }
}

export class LaunchpadButtonLookImage extends LaunchpadButtonLookBase {
  public uri: string;

  constructor(uri: string) {
    super(LaunchpadButtonLookType.Image)
    this.uri = uri;
  }
}

export type LaunchpadButtonLook = LaunchpadButtonLookText | LaunchpadButtonLookImage


export class LaunchpadButton {
  public look: LaunchpadButtonLookText | LaunchpadButtonLookImage

  public loop: boolean

  public color: LaunchpadSolidButtonColor | LaunchpadFlashingButtonColor | LaunchpadPulsingButtonColor | LaunchpadRGBButtonColor;
  public activeColor?: LaunchpadSolidButtonColor | LaunchpadFlashingButtonColor | LaunchpadPulsingButtonColor | LaunchpadRGBButtonColor;
  
  public down: Action[];
  public up: Action[];

  constructor() {
    this.look = new LaunchpadButtonLookText("");
    this.loop = false;

    this.color = new LaunchpadRGBButtonColor("#000000");

    this.down = [];
    this.up = [];
  }
}






/* export class Button {
  public title: string
  public x: number
  public y: number

  public color: Color
  public activeColor: Color

  public pressed: Action[] = []
  public released: Action[] = []

  public loop: boolean = false;

  constructor(title: string, x: number, y: number, color = {r:0, g: 0, b: 0, mode: 3, one: undefined, two: undefined}) {
    this.title = title;
    this.x = x;
    this.y = y;
    this.color = color;
    this.pressed = [];
    this.released = [];
  }
} */