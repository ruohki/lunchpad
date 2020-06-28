import { v4 as uuid } from 'uuid';
import { ActionType, Action } from '../../';

import { JsonProperty, Serializable } from 'typescript-json-serializer';
import { IOBSStudioContext } from '../../../contexts/obs-studio';

@Serializable()
export class OBSToggleStreaming extends Action {
  @JsonProperty()
  public target: ToggleTarget
  @JsonProperty()
  public mode: StartOrStop;

  private cancel: boolean;
  private OBSStudio: Partial<IOBSStudioContext>

  constructor(mode: StartOrStop = StartOrStop.Start, id: string = uuid()) {
    super(ActionType.OBSStartStopStream, id);
    this.mode = mode;
  }

  setOBSContext = (obsContext: Partial<IOBSStudioContext>) => this.OBSStudio = obsContext;

  public async Run(): Promise<unknown> {
    if (this.target === ToggleTarget.Streaming) return this.OBSStudio.toggleStreaming(this.mode);
    if (this.target === ToggleTarget.Recording) return this.OBSStudio.toggleRecording(this.mode);
    if (this.target === ToggleTarget.ReplayBuffer) return this.OBSStudio.toggleReplay(this.mode);
  }

  public Stop() {
    this.cancel = true;
  }
}

export enum StartOrStop {
  Start,
  Stop,
  Toggle,
}

export enum ToggleTarget {
  Streaming,
  Recording,
  ReplayBuffer
}