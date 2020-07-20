import * as React from 'react';
import lodash from 'lodash';

import { Icon, TriangleRight, Rectangle, TTS } from '@lunchpad/icons';
import { Split, Child, Row, IconButton, Input, Select, Switch, Slider } from '@lunchpad/base';

import Pill from '../pill'
import { TextToSpeech } from './classes';

// TODO: Route to another output

interface ITextToSpeechPill {
  action: TextToSpeech
  expanded?: boolean
  onChange?: (action: TextToSpeech) => void
  onRemove?: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
}

export const TextToSpeechPill: React.SFC<ITextToSpeechPill> = (props) => {
  const [ showBody, setExpanded ] = React.useState<boolean>(props.expanded);
  const [ playing, setPlaying ] = React.useState<boolean>(false);
  const [ utterance, setUtterance ] = React.useState<SpeechSynthesisUtterance>();

  const setProp = (prop) => {
    props.onChange(Object.assign(props.action, prop))
  }

  const Speak = () => {
    if (!utterance) return;
    Stop();
    setPlaying(true);
    utterance.volume = props.action.volume;
    speechSynthesis.speak(utterance);
  }
  
  const Stop = () => {
    if (!speechSynthesis.speaking) return;
    speechSynthesis.cancel();
  }

  React.useEffect(() => {
    const utt = new SpeechSynthesisUtterance(props.action.text);
    const vc = lodash.find(voices, v => v.voiceURI === props.action.voice)
    if (!lodash.isEmpty(props.action.voice)) utt.voice = vc;
    setUtterance(utt);
  }, [ props.action.text, props.action.voice ])

  React.useEffect(() => {
    if (!utterance) return;
    utterance.onend = () => setPlaying(false)
  }, [ utterance ])
  const voices = speechSynthesis.getVoices();

  const Collapsed = (
    <Split direction="row">
      <Child grow basis="75%" whiteSpace="nowrap" padding="0 1rem 0 0">
        <div style={{textOverflow: "ellipsis", overflow: "hidden"}}>
          TTS: ({lodash.find(voices, v => v.voiceURI === props.action.voice)?.lang}) {lodash.truncate(props.action.text, {length: 15})}
        </div>
      </Child>
      <Child grow basis="25%">
        <Slider
          value={props.action.volume * 100}
          onChange={(e) => setProp({ volume: (parseInt(e.target.value) / 100)})}
        />
      </Child>
      <Child padding="0 0 0 1rem">{Math.round(props.action.volume * 100)}%</Child>
      {!playing && <Child padding="0 0 0 1rem"><IconButton icon={<Icon icon={TriangleRight} />} onClick={(e) => Speak()} /></Child>}
      {playing && <Child padding="0 0 0 1rem"><IconButton icon={<Icon icon={Rectangle} />} onClick={() => Stop()} /></Child>}
    </Split>
  )

  const Expanded = (
    <Split direction="row">
      <Child grow whiteSpace="nowrap" padding="0 1rem 0 0">
        <div style={{textOverflow: "ellipsis", overflow: "hidden"}}>
        TTS: ({lodash.find(voices, v => v.voiceURI === props.action.voice)?.lang}) {lodash.truncate(props.action.text, {length: 30})}
        </div>
      </Child>
    </Split>
  )

  return (
    <Pill
      isExpanded={showBody}
      icon={<Icon icon={TTS} />}
      expanded={Expanded}
      collapsed={Collapsed}
      onRemove={() => props.onRemove(props.action.id)}
      onMoveUp={props.onMoveUp ? () => props.onMoveUp(props.action.id) : null}
      onMoveDown={props.onMoveDown ? () => props.onMoveDown(props.action.id) : null}
      onExpand={() => setExpanded(true)}
      onCollapse={() => setExpanded(false)}
    >
      <Split padding="0 0 1rem 0">
        <Row title="">
          <Split direction="row">
            <Child padding="0 1rem 0 0">
              <Switch
                value={props.action.wait}
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
            value={props.action.voice}
            onChange={(e) => setProp({ voice: voices.find(v => v.voiceURI === e.target.value)?.voiceURI })}
          >
            {voices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.localService ? v.lang : `${v.lang} *`})</option>)}
          </Select>
        </Row>
        <Row title="Volume:">
          <Split direction="row">
            <Child grow>
              <Slider
                value={props.action.volume * 100}
                onChange={(e) => setProp({ volume: (parseInt(e.target.value) / 100)})}
              />
            </Child>
            <Child padding="0 0 0 1rem">
              {Math.round(props.action.volume * 100)}%
            </Child>
            {!playing && <Child padding="0 0 0 1rem">
              <IconButton icon={<Icon icon={TriangleRight} />} onClick={() => Speak()} />
            </Child>}
            {playing && <Child padding="0 0 0 1rem">
              <IconButton icon={<Icon icon={Rectangle} />} onClick={() => Stop()}/>
            </Child>}
          </Split>
        </Row>
        <Row title="Text:">
          <Input value={props.action.text} onChange={e => setProp({ text: e.target.value })} />
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