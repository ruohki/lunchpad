import Launchpad from './launchpadbase';

class LaunchpadX extends Launchpad {
  public static InputMatcher = () => new RegExp("MIDIIN \\(LPX MIDI\\)");
  public static OutputMatcher = () => new RegExp("/^LPX MIDI");
  public static GetName = () => "Launchpad MK2";

  public Initialize() {
    super.Initialize();
  }
}

export default LaunchpadX