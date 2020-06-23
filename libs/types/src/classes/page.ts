import { LaunchpadButton } from './button'

export class Page {
  public name: string;
  public buttons: Record<number, Record<number, LaunchpadButton>>;
  public id: string;

  constructor(name: string, id: string) {
    this.name = name;
    this.id = id;
    this.buttons = {}
  }
}
