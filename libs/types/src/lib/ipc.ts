
/* type LightingType = 'Static' | 'Flash' | 'Pulse' | 'RGB' */

export enum LightingType {
  Static = 0,
  Flash = 1,
  Pulse = 2,
  RGB = 3
}

export interface RGBColor {
  r: number
  g: number
  b: number
}

type IndexColor = number;

export interface FlashColor {
  a: IndexColor
  b: IndexColor
}

export interface BaseColorSpec {
  type: LightingType
  button: number
  color: IndexColor | FlashColor | RGBColor
}

export interface IndexColorSpec extends BaseColorSpec {
  type: LightingType.Static | LightingType.Pulse
  button: number
  color: IndexColor
}

export interface RGBColorSpec extends BaseColorSpec {
  type: LightingType.RGB
  button: number
  color: RGBColor
}

export interface FlashColorSpec extends BaseColorSpec {
  type: LightingType.Flash
  button: number
  color: RGBColor
}

export class Colorspec implements BaseColorSpec {
  public type: LightingType;
  public button: number;
  public color: IndexColor | FlashColor | RGBColor;

  constructor(props: BaseColorSpec | IndexColorSpec | FlashColorSpec | RGBColorSpec ) {
    this.type = props.type;
    this.button = props.button;
    this.color = props.color;
  }

  toArray(): number[] {
    if ((this.type === LightingType.Static) || (this.type === LightingType.Pulse)) {
      return [ this.type, this.button, this.color as IndexColor ]
    } else if (this.type === LightingType.Flash) {
      const color = this.color as FlashColor
      return [ this.type, this.button, color.a, color.b ]
    } else {
      const color = this.color as RGBColor
      return [ this.type, this.button, color.r, color.g, color.b ]
    }
  }
}