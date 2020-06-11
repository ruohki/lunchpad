import * as lodash from 'lodash';

import { TextToSpeech } from '@lunchpad/types';
import { MacroAction } from './index';

export class TextToSpeechAction extends MacroAction {
  private action: TextToSpeech;
  private utterance: SpeechSynthesisUtterance;

  constructor(action: TextToSpeech) {
    super()
    this.action = action;
    this.id = action.id;
    this.wait = action.wait;

    this.utterance = new SpeechSynthesisUtterance(this.action.text);
    const voices = speechSynthesis.getVoices();
    const voice = lodash.find(voices, v => v.voiceURI === this.action.voice);
    this.utterance.voice = voice;
    this.utterance.volume = action.volume;
  }

  public async Run(): Promise<unknown> {
    return new Promise(resolve => {
      this.utterance.onend = () => {
        resolve()
      };

      speechSynthesis.speak(this.utterance);
    })
  }

  public Stop() {
    speechSynthesis.cancel();
  }
}