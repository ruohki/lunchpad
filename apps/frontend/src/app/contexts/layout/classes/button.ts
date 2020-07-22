import { JsonProperty, Serializable } from 'typescript-json-serializer';
import { LaunchpadButtonLookText, LaunchpadButtonLookImage, LaunchpadButtonLookBase, LaunchpadButtonLookType } from './look';
import { LaunchpadSolidButtonColor, LaunchpadFlashingButtonColor, LaunchpadPulsingButtonColor, LaunchpadRGBButtonColor, LaunchpadButtonColorBase, LaunchpadButtonColorMode } from './colors';
import { Action, ActionType } from '../../../actions';
import { Delay } from '../../../actions/delay';
import { FlipFlopEnd, FlipFlopMiddle, FlipFlopStart } from '../../../actions/flipflop';
import { LaunchApp } from '../../../actions/launchapp';
import { OBSSwitchScene, OBSSaveReplay } from '../../../actions/obs-studio';
import { PlaySound } from '../../../actions/playsound';
import { Hotkey } from '../../../actions/hotkey/classes';
import { PushToTalkStart, PushToTalkEnd } from '../../../actions/pushtotalk';
import { RestartThisMacro } from '../../../actions/restartthismacro';
import { SetColor } from '../../../actions/setcolor';
import { StopAllMacros } from '../../../actions/stopallmacros';
import { StopThisMacro } from '../../../actions/stopthismacro';
import { SwitchPage } from '../../../actions/switchpage';
import { TextToSpeech } from '../../../actions/tts';
import { OBSToggleSource } from '../../../actions/obs-studio/togglesource';
import { OBSToggleStreaming } from '../../../actions/obs-studio/togglestreaming';
import { OBSToggleFilter } from '../../../actions/obs-studio/togglefilter';
import { OBSToggleMixer } from '../../../actions/obs-studio/setaudio';

export const LookPredicate = (json: LaunchpadButtonLookBase) => {
  if (json.type === LaunchpadButtonLookType.Image) return LaunchpadButtonLookImage
  if (json.type === LaunchpadButtonLookType.Text) return LaunchpadButtonLookText
}

export const ColorPredicate = (json: LaunchpadButtonColorBase) => {
  if (json.mode === LaunchpadButtonColorMode.Static) return LaunchpadSolidButtonColor;
  if (json.mode === LaunchpadButtonColorMode.Flashing) return LaunchpadFlashingButtonColor;
  if (json.mode === LaunchpadButtonColorMode.Pulsing) return LaunchpadPulsingButtonColor;
  if (json.mode === LaunchpadButtonColorMode.RGB) return LaunchpadRGBButtonColor;
}

const ActionPredicate = (json: Action) => {
  //if (json.type === ActionType.PlaySound) return PlaySound;
  //if (json.type === ActionType.TextToSpeech) return TextToSpeech;
  if (json.type === ActionType.Delay) return Delay;
  if (json.type === ActionType.FlipFlopStart) return FlipFlopStart;
  if (json.type === ActionType.FlipFlopMiddle) return FlipFlopMiddle;
  if (json.type === ActionType.FlipFlopEnd) return FlipFlopEnd;
  if (json.type === ActionType.LaunchApplication) return LaunchApp;
  if (json.type === ActionType.PressAHotkey) return Hotkey;
  if (json.type === ActionType.PushToTalkEnd) return PushToTalkStart;
  if (json.type === ActionType.PushToTalkStart) return PushToTalkEnd;
  if (json.type === ActionType.RestartThisMacro) return RestartThisMacro;
  if (json.type === ActionType.SetColor) return SetColor;
  if (json.type === ActionType.StopAllMacros) return StopAllMacros;
  if (json.type === ActionType.StopThisMacro) return StopThisMacro;
  if (json.type === ActionType.SwitchPage) return SwitchPage;
  if (json.type === ActionType.OBSSwitchScene) return OBSSwitchScene;
  if (json.type === ActionType.OBSToggleSource) return OBSToggleSource;
  if (json.type === ActionType.OBSStartStopStream) return OBSToggleStreaming;
  if (json.type === ActionType.OBSSaveReplayBuffer) return OBSSaveReplay;
  if (json.type === ActionType.OBSToggleFilter) return OBSToggleFilter;
  if (json.type === ActionType.OBSToggleMixer) return OBSToggleMixer;
  
  //if (json.type === ActionType.OBSToggleFilter) return Delay;
  //if (json.type === ActionType.OBSToggleMixer) return Delay;
  
  //if (json.type === ActionType.PerformWebrequest) return Delay;
  //if (json.type === ActionType.VoiceMeeter) return Delay;
}

@Serializable()
export class LaunchpadButton {
  
  @JsonProperty({ predicate: LookPredicate })
  public look: LaunchpadButtonLookText | LaunchpadButtonLookImage

  @JsonProperty()
  public loop: boolean

  @JsonProperty({ predicate: ColorPredicate })
  public color: LaunchpadSolidButtonColor | LaunchpadFlashingButtonColor | LaunchpadPulsingButtonColor | LaunchpadRGBButtonColor;
  
  @JsonProperty({ predicate: ColorPredicate })
  public activeColor?: LaunchpadSolidButtonColor | LaunchpadFlashingButtonColor | LaunchpadPulsingButtonColor | LaunchpadRGBButtonColor;
  
  @JsonProperty({ type: Action, predicate: ActionPredicate, onDeserialize: (actions: Action[], data: LaunchpadButton) => {
    //console.log("Actions", actions)
    return actions.map(action => {
      if (action.type === ActionType.PlaySound) {
        const sound = action as PlaySound;
        //console.log(sound)
        return new PlaySound(sound.soundfile, sound.outputDevice, sound.duration, sound.id);
      } else if (action.type === ActionType.TextToSpeech) {
        const tts = action as TextToSpeech;
        return new TextToSpeech(tts.text, tts.volume);
      } else if (action.type === ActionType.SetColor) {
        const color = ((action as SetColor).color as LaunchpadButtonColorBase)
        const setColor = new SetColor;
        if ((action as SetColor).color.mode === LaunchpadButtonColorMode.Static) setColor.color = new LaunchpadSolidButtonColor((color as LaunchpadSolidButtonColor).color);
        if ((action as SetColor).color.mode === LaunchpadButtonColorMode.Flashing) setColor.color = new LaunchpadFlashingButtonColor((color as LaunchpadFlashingButtonColor).color, (color as LaunchpadFlashingButtonColor).alt);
        if ((action as SetColor).color.mode === LaunchpadButtonColorMode.Pulsing) setColor.color = new LaunchpadPulsingButtonColor((color as LaunchpadPulsingButtonColor).color);
        if ((action as SetColor).color.mode === LaunchpadButtonColorMode.RGB) setColor.color = new LaunchpadRGBButtonColor((color as LaunchpadRGBButtonColor).color);
        return setColor;
      }
      return action;
    })
  }})
  public down: Action[];
  
  @JsonProperty({ type: Action, predicate: ActionPredicate, onDeserialize: (actions: Action[], data: LaunchpadButton) => {
    //console.log("Actions", actions)
    return actions.map(action => {
      if (action.type === ActionType.PlaySound) {
        const sound = action as PlaySound;
        //console.log(sound)
        return new PlaySound(sound.soundfile, sound.outputDevice, sound.duration, sound.id);
      } else if (action.type === ActionType.TextToSpeech) {
        const tts = action as TextToSpeech;
        return new TextToSpeech(tts.text, tts.volume);
      } else if (action.type === ActionType.SetColor) {
        const color = ((action as SetColor).color as LaunchpadButtonColorBase)
        if ((action as SetColor).color.mode === LaunchpadButtonColorMode.Static) return new LaunchpadSolidButtonColor((color as LaunchpadSolidButtonColor).color);
        if ((action as SetColor).color.mode === LaunchpadButtonColorMode.Flashing) return new LaunchpadFlashingButtonColor((color as LaunchpadFlashingButtonColor).color, (color as LaunchpadFlashingButtonColor).alt);
        if ((action as SetColor).color.mode === LaunchpadButtonColorMode.Pulsing) return new LaunchpadPulsingButtonColor((color as LaunchpadPulsingButtonColor).color);
        if ((action as SetColor).color.mode === LaunchpadButtonColorMode.RGB) return new LaunchpadRGBButtonColor((color as LaunchpadRGBButtonColor).color);
      }
      return action;
    })
  }})
  public up: Action[];

  constructor(look: LaunchpadButtonLookText = new LaunchpadButtonLookText(""), color: LaunchpadRGBButtonColor = new LaunchpadRGBButtonColor("#000000")) {
    this.look = look;
    this.color = color;
    this.loop = false;
    this.down = [];
    this.up = [];
  }
}