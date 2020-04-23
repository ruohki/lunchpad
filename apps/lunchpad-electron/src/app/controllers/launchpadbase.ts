import * as easymidi from 'easymidi';
import os from 'os';
import { EventEmitter } from 'events';

// Hacking the system
//@ts-ignore
easymidi.Output.prototype.send = function (type, args) {
  if (!args) {
    console.log("Sending RAW", type)
    this._output.sendMessage(type);
  } else {
    this._output.sendMessage(this.parseMessage(type, args));
  }
};

export interface OSRegex {
  win32?: RegExp
  linux?: RegExp
  darwin?: RegExp
}

interface LaunchpadInterface { }

declare interface Launchpad {
  on(event: 'pressed', listener: (button: number) => void): this;
  on(event: 'released', listener: (button: number) => void): this;
}

class Launchpad extends EventEmitter implements LaunchpadInterface {
  protected MIDIInput: easymidi.Input;
  protected MIDIOutput: easymidi.Output;

  protected GetInputs = (): string[] => easymidi.getInputs();
  protected GetOutputs = () : string[] => easymidi.getOutputs();

  public static InputMatcher = (): OSRegex | Error => new Error("Not Implemented!");
  public static OutputMatcher = (): OSRegex | Error => new Error("Not Implemented!");
  public static GetName = (): string => "";
/*   public static ButtonToXY = (button: number): { x: number, y: number } => null;
  public static XYToButton = (x: number, y: number): number => null
 */

  public static IsConnected(): boolean {
    const inputRegex: RegExp = this.InputMatcher()[os.platform()]  as RegExp;
    const rawInputs: string[] = easymidi.getInputs().filter(s => inputRegex.test(s));

    return rawInputs.length > 0;
  }

  public GetStatic = () => <typeof Launchpad>this.constructor;
  
  public Initialize() {
    console.log(os.platform())
    const inputRegex: RegExp = this.GetStatic().InputMatcher()[os.platform()]  as RegExp;
    const outputRegex: RegExp = this.GetStatic().OutputMatcher()[os.platform()]  as RegExp;

    const inputs: string[] = easymidi.getInputs().filter(i => inputRegex.test(i));
    const outputs: string[] = easymidi.getOutputs().filter(o => outputRegex.test(o));
    console.log(inputRegex, outputRegex)
    if (inputs.length > 0 && outputs.length > 0) {
      const input = inputs.pop();
      const output = outputs.pop();

      this.MIDIInput = new easymidi.Input(input);
      this.MIDIOutput = new easymidi.Output(output);
    }
  }

  public Destroy() {
    this.MIDIInput.close();
    this.MIDIOutput.close();
  }

  public send(type: 'noteon' , msg: easymidi.NoteOnOffMsg): void;
  public send(type: 'noteoff' , msg: easymidi.NoteOnOffMsg): void;
  public send(type: 'cc' , msg: easymidi.ContinuousControllerMsg): void;
  public send(type: 'poly aftertouch' , msg: easymidi.NotePolyAftertouchMsg): void;
  public send(type: 'channel aftertouch' , msg: easymidi.ChannelAfterTouchMsg): void;
  public send(type: 'program' , msg: easymidi.ProgramMsg): void;
  public send(type: 'pitch' , msg: easymidi.PitchMsg): void;
  public send(type: 'position' , msg: easymidi.PositionMsg): void;
  public send(type: 'select' , msg: easymidi.SelectMsg): void;
  public send(type: 'sysex' , msg: number[]): void;
  public send(type: 'raw' , msg: number[]): void;
  public send(type: 'clock' | 'start' | 'continue' | 'stop'): void;
  public send(type: 'noteon' | 'noteoff' | 'cc' | 'poly aftertouch' | 'channel aftertouch' | 'program' | 'pitch' | 'position' | 'select' | 'sysex' | 'raw' | 'clock' | 'start' | 'continue' | 'stop', msg?): void {
    switch (type) {
      case 'clock':
      case 'start':
      case 'continue':
      case 'stop': return this.MIDIOutput.send(type);
      case 'noteon':
      case 'noteoff':
      case 'cc':
      case 'poly aftertouch':
      case 'channel aftertouch':
      case 'pitch':
      case 'program':
      case 'position':
      case 'select': return this.MIDIOutput.send(type, msg);
      case 'sysex':
        return this.MIDIOutput.send(type,  [ 240, ...msg, 247]);
      case 'raw': 
        return this.MIDIOutput.send(msg);
    }
  }
  public clear(): void {}
}

export default Launchpad;