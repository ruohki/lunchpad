import lodash from 'lodash';
import { v4 as uuid } from 'uuid';
import { ActionType, Action } from '..';

import { JsonProperty, Serializable } from 'typescript-json-serializer';

@Serializable()
export class TextToSpeech extends Action {
  private utterance: SpeechSynthesisUtterance;
  
  @JsonProperty()
  public text: string;

  @JsonProperty()
  public voice: string;

  @JsonProperty()
  public volume: number;

  constructor(text: string, volume = 1, id: string = uuid()) {
    super(ActionType.TextToSpeech);
    this.id = id;
    this.text = text;
    this.volume = volume;
    
    this.utterance = new SpeechSynthesisUtterance(text);

    const voices = speechSynthesis.getVoices();
    const voice = lodash.find(voices, v => v.default)
    if (voice) {
      this.voice = voice.voiceURI;
      this.utterance.voice = voice;
      this.utterance.volume = volume;
    }

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