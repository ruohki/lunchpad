import Launchpad, { OSRegex } from './launchpadbase';
import * as lodash from 'lodash';

import { SYSEX_HEADER, SYSEX_COLOR } from '@lunchpad/types'
class LaunchpadX extends Launchpad {
  private buttonsPressed: Map<number, any> = new Map();

  public static InputMatcher = (): OSRegex => ({
    win32: new RegExp("^MIDIIN2 \\(LPX MIDI\\)"),
    darwin: new RegExp("Launchpad X LPX MIDI Out")
  })

  public static OutputMatcher = (): OSRegex => ({
    win32: new RegExp("(^LPX MIDI)|()$"),
    darwin: new RegExp("Launchpad X LPX MIDI In")
  })

  public static GetName = () => "Launchpad X";

  /* public static ButtonToXY(button: number): { x: number, y: number } {
    const base = button 
    
    const x = (base % 10) -1 
    const y = ((base - (x + 1)) / 10) - 1
    return { x, y }
  }

  public static XYToButton(x: number, y: number): number {
    return (y + 1) * 10 + x + 1
  } */

  public Initialize() {
    super.Initialize();

    this.buttonsPressed.clear();

    this.send('sysex', [...SYSEX_HEADER, 14, 0 ]);
    this.send('sysex', [...SYSEX_HEADER, 0, 127 ]);

    this.MIDIInput.on('noteon', (msg) => {
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
    
    this.MIDIInput.on('poly aftertouch', (msg) => {
      if (!this.buttonsPressed.has(msg.note) && msg.pressure > 50) {
        this.buttonsPressed.set(msg.note, msg);
        this.emit('pressed', msg.note);
      }

      if (msg.pressure === 0) {
        if (!this.buttonsPressed.has(msg.note)) return;

        this.buttonsPressed.delete(msg.note)
        this.emit('released', msg.note);
      }
    })

    this.MIDIInput.on('cc', (msg) => {
      if (msg.value > 0) {
        this.emit('pressed', msg.controller);
      } else {
        this.emit('released', msg.controller);
      }
    })

    this.clear();
  }

  public clear() {
    const rest = lodash.flatten(lodash.range(11, 11+89).map(i => (i === 99 ? [2, 99, 45] : [0, i, 0])))
    this.send('sysex', [ ...SYSEX_COLOR, ...rest ])
  }
}

export default LaunchpadX