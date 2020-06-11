import * as React from 'react';
import * as lodash from 'lodash';

import { TextToSpeech } from '@lunchpad/types';
import { IconComment, IconPlay, IconStop } from '@lunchpad/icons';

import { Pill } from './pill'
import { Split, Child, Row } from '../basic/layout';
import { IconButton, Input, Select, Switch, Slider } from '../basic';

// TODO: Route to another output

interface ITextToSpeechPill {
  action: TextToSpeech
  expanded?: boolean
  onChange?: (action: TextToSpeech) => void
  onRemove?: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
}

export const TextToSpeechPill: React.SFC<ITextToSpeechPill> = ({ action, expanded, onChange, onRemove, onMoveUp, onMoveDown }) => {
  const [ showBody, setExpanded ] = React.useState<boolean>(expanded);
  const [ playing, setPlaying ] = React.useState<boolean>(false);
  const [ utterance, setUtterance ] = React.useState<SpeechSynthesisUtterance>();

  const setProp = (props) => {
    onChange(Object.assign({}, action, props))
  }

  const Speak = () => {
    if (!utterance) return;
    Stop();
    setPlaying(true);
    utterance.volume = action.volume;
    speechSynthesis.speak(utterance);
  }
  
  const Stop = () => {
    if (!speechSynthesis.speaking) return;
    speechSynthesis.cancel();
  }

  React.useEffect(() => {
    const utt = new SpeechSynthesisUtterance(action.text);
    const vc = lodash.find(voices, v => v.voiceURI === action.voice)
    if (!lodash.isEmpty(action.voice)) utt.voice = vc;
    setUtterance(utt);
  }, [ action.text, action.voice ])

  React.useEffect(() => {
    if (!utterance) return;
    utterance.onend = () => setPlaying(false)
  }, [ utterance ])
  const voices = speechSynthesis.getVoices();

  const Collapsed = (
    <Split direction="row">
      <Child grow basis="75%" whiteSpace="nowrap" padding="0 1rem 0 0">
        <div style={{textOverflow: "ellipsis", overflow: "hidden"}}>
          TTS: ({lodash.find(voices, v => v.voiceURI === action.voice)?.lang}) {lodash.truncate(action.text, {length: 100})}
        </div>
      </Child>
      <Child grow basis="25%">
        <Slider
          value={action.volume * 100}
          onChange={(e) => setProp({ volume: (parseInt(e.target.value) / 100)})}
        />
      </Child>
      <Child padding="0 0 0 1rem">{Math.round(action.volume * 100)}%</Child>
      {!playing && <Child padding="0 0 0 1rem"><IconButton icon={<IconPlay />} onClick={(e) => Speak()} /></Child>}
      {playing && <Child padding="0 0 0 1rem"><IconButton icon={<IconStop />} onClick={() => Stop()} /></Child>}
    </Split>
  )

  const Expanded = (
    <Split direction="row">
      <Child grow whiteSpace="nowrap" padding="0 1rem 0 0">
        <div style={{textOverflow: "ellipsis", overflow: "hidden"}}>
        TTS: ({lodash.find(voices, v => v.voiceURI === action.voice)?.lang}) {lodash.truncate(action.text, {length: 100})}
        </div>
      </Child>
    </Split>
  )

  return (
    <Pill
      isExpanded={showBody}
      icon={<IconComment />}
      expanded={Expanded}
      collapsed={Collapsed}
      onRemove={() => onRemove(action.id)}
      onMoveUp={onMoveUp ? () => onMoveUp(action.id) : null}
      onMoveDown={onMoveDown ? () => onMoveDown(action.id) : null}
      onExpand={() => setExpanded(true)}
      onCollapse={() => setExpanded(false)}
    >
      <Split padding="0 0 1rem 0">
        <Row title="">
          <Split direction="row">
            <Child padding="0 1rem 0 0">
              <Switch
                value={action.wait}
                onChange={wait => setProp({ wait })}
              />
            </Child>
            <Child grow>
              <span>Await execution of this action</span>
            </Child>
          </Split>
        </Row>
        <Row title="Voice:">
          <Select
            value={action.voice}
            onChange={(e) => setProp({ voice: voices.find(v => v.voiceURI === e.target.value)?.voiceURI })}
          >
            {voices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.localService ? v.lang : `${v.lang} *`})</option>)}
          </Select>
        </Row>
        <Row title="Volume:">
          <Split direction="row">
            <Child grow>
              <Slider
                value={action.volume * 100}
                onChange={(e) => setProp({ volume: (parseInt(e.target.value) / 100)})}
              />
            </Child>
            <Child padding="0 0 0 1rem">
              {Math.round(action.volume * 100)}%
            </Child>
            {!playing && <Child padding="0 0 0 1rem">
              <IconButton icon={<IconPlay />} onClick={() => Speak()} />
            </Child>}
            {playing && <Child padding="0 0 0 1rem">
              <IconButton icon={<IconStop />} onClick={() => Stop()}/>
            </Child>}
          </Split>
        </Row>
        <Row title="Text:">
          <Input value={action.text} onChange={e => setProp({ text: e.target.value })} />
        </Row>
      </Split>
    </Pill>
  )
}

TextToSpeechPill.defaultProps = {
  expanded: false,
  onChange: () => {},
  onRemove: () => {},
}