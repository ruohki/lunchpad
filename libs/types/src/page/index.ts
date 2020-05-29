import { Button } from '../actions'

export class Page {
  public name: string;
  public buttons: Record<number, Record<number, Button>>;
  public id: string;

  constructor(name: string, id: string) {
    this.name = name;
    this.id = id;
    this.buttons = {}
  }
}

type Color = {
  r: number,
  g: number,
  b: number
}
