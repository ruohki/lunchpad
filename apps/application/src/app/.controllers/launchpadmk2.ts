import Launchpad, { OSRegex } from './launchpadbase';
import * as lodash from 'lodash';
import { RGBColor } from '@lunchpad/types';

export const SYSEX_HEADER = [ 0, 32, 41, 2, 24 ];
export const SYSEX_COLOR = [...SYSEX_HEADER, 11];

class LaunchpadMK2 extends Launchpad {
  private buttonsPressed: Map<number, any> = new Map();

  public static InputMatcher = (): OSRegex => ({
    win32: new RegExp("Launchpad MK2"),
    darwin: new RegExp("Launchpad MK2")
  })
 
  public static OutputMatcher = (): OSRegex => ({
    win32: new RegExp("Launchpad MK2"),
    darwin: new RegExp("Launchpad MK2")
  })

  public static GetName = () => "Launchpad MK2";

  public Initialize() {
    super.Initialize();

    this.buttonsPressed.clear();

    this.MIDIInput.on('noteon', (msg) => {
      console.log("Noteon", msg)
      if (msg.velocity === 0) {

        if (!this.buttonsPressed.has(msg.note)) return;
        this.buttonsPressed.delete(msg.note)
        this.emit('released', msg.note);
      };
      if (msg.velocity >= 25) {
        this.buttonsPressed.set(msg.note, msg);
        this.emit('pressed', msg.note);
      }
    });

    this.MIDIInput.on('cc', (msg) => {
      console.log("CC", msg)
      if (msg.value > 0) {
        this.emit('pressed', msg.controller);
      } else {
        this.emit('released', msg.controller);
      }
    })

    this.clear();
  }
  
  public static GetAllButtons = (): number[] => [
    ...lodash.flatten(lodash.range(0, 8).map(y => lodash.range(0,9).map(x => ((y+1) * 10) + 1 + x))),
    ...lodash.range(104, 112).map(e => e)
  ]

  public setColor(button: number, color: RGBColor): void {
    this.send('sysex', [...SYSEX_COLOR, button, ...color ])
  } 

  public setManyColors(args: Array<[number, RGBColor]>, clear: boolean = false): void {
    if (clear) {
      //Clears the board and sets the desired colors
      const data = lodash.flatten(LaunchpadMK2.GetAllButtons().map(b => {
        const el = lodash.find(args, a => a[0] === b);
        return el ? [b, ...el[1]] : [b, 0, 0, 0]
      }))
      this.send('sysex', [...SYSEX_COLOR, ...data ])

    } else {
      // Sets the desired colors ontop existing ones (does not clear)
      const data = lodash.flatten(args.map(([button, color]) => [button, ...color]));
      this.send('sysex', [...SYSEX_COLOR, ...data ])
    }
  }

  public clear() {
    const data = lodash.flatten(LaunchpadMK2.GetAllButtons().map(b => [b, 0, 0, 0]))
    this.send('sysex', [ ...SYSEX_COLOR, ...data ])
  }
} 

export default LaunchpadMK2