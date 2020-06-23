import * as lodash from 'lodash';

export class Counter {
  private value: number;

  constructor(initial = 0) {
    this.value = initial;
  }
  public Value = (): number => this.value;
  public Inc = (): number => {
    this.value++;
    console.log("Inc", this.value)
    return this.value;
  }

  public Dec = (): number => {
    this.value--;
    console.log("Dec", this.value)
    return this.value;
  }

  public Zero = (): number => this.value = 0;
}