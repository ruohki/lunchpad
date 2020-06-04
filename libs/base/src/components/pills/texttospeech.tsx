import * as React from 'react';
import * as lodash from 'lodash';

import { TextToSpeech } from '@lunchpad/types';
import { IconEdit, IconTimes, IconCheck, IconTrash, IconUp, IconDown, IconComment, IconPlay, IconStop } from '@lunchpad/icons';

import { PillHeader, PillBorder } from './pill'
import { Split, Child, VerticalPipe, Row } from '../basic/layout';
import { IconButton, Tooltip, Input, Select, Switch } from '../basic';
import { COLOR_REDISH, COLOR_BLURPLE } from '../../theme';

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
  const [ text, setText ] = React.useState<string>(action.text);
  const [ voice, setVoice ] = React.useState<string>(action.voice)

  const [ playing, setPlaying ] = React.useState<boolean>(false);
  const [ utterance, setUtterance ] = React.useState<SpeechSynthesisUtterance>();
  
  const [ wait, setWait ] = React.useState<boolean>(action.wait);

  const change = () => {
    const actn = new TextToSpeech(
      text,
      action.id
    )
    actn.voice = voice;
    actn.wait = wait;
    onChange(actn)
    setExpanded(false);
  }

  const Speak = () => {
    if (!utterance) return;
    Stop();
    setPlaying(true);
    speechSynthesis.speak(utterance);
  }
  
  const Stop = () => {
    if (!speechSynthesis.speaking) return;
    speechSynthesis.cancel();
  }

  React.useEffect(() => {
    const utt = new SpeechSynthesisUtterance(text);
    const vc = lodash.find(voices, v => v.voiceURI === voice)
    if (!lodash.isEmpty(voice)) utt.voice = vc;
    setUtterance(utt);
  }, [ text, voice ])

  React.useEffect(() => {
    if (!utterance) return;
    utterance.onend = () => setPlaying(false)
  }, [ utterance ])
  const voices = speechSynthesis.getVoices();

  return (
    <PillBorder show={showBody}>
      <PillHeader expanded={showBody}>
        <Split direction="row">
          <Child padding={"0 1rem 0 0"}><IconComment /></Child>
          {showBody ? <>
            <Child grow width="40%" whiteSpace="nowrap"><div style={{textOverflow: "ellipsis", overflow: "hidden"}}>Edit: TTS</div></Child>
            {!playing && <Child padding="0 0 0 1rem"><IconButton icon={<IconPlay />} onClick={() => Speak()} /></Child>}
            {playing && <Child padding="0 0 0 1rem"><IconButton icon={<IconStop />} onClick={() => Stop()} /></Child>}
            <Child padding="0 1rem 0 1rem"><VerticalPipe /></Child>
            <Child padding="0">
              <Tooltip title="Removes the action from the list! ITS GONE!" >
                <IconButton hover={COLOR_REDISH} onClick={() => onRemove(action.id)} icon={<IconTrash />} />
              </Tooltip>
            </Child>
            <Child padding="0 0 0 2rem">
              <Tooltip title="Update this action with the current settings" >
                <IconButton hover={COLOR_BLURPLE} onClick={change} icon={<IconCheck />} />
              </Tooltip>
            </Child>
            <Child padding="0 0 0 2rem">
              <Tooltip title="Discard changes made to this action" >
                <IconButton hover={COLOR_REDISH} onClick={() => setExpanded(false)} icon={<IconTimes />} />
              </Tooltip>
            </Child>
          </> : <>
            <Child grow width="50%" whiteSpace="nowrap" padding="0 1rem 0 0"><div style={{textOverflow: "ellipsis", overflow: "hidden"}}>TTS: ({lodash.find(voices, v => v.voiceURI === voice)?.lang}) {lodash.truncate(text, {length: 100})}</div></Child>
            {!playing && <Child padding="0 0 0 1rem"><IconButton icon={<IconPlay />} onClick={() => Speak()} /></Child>}
            {playing && <Child padding="0 0 0 1rem"><IconButton icon={<IconStop />} onClick={() => Stop()} /></Child>}
            <Child padding="0 1rem 0 1rem"><VerticalPipe /></Child>
            <Child padding="0"><IconButton disabled={!onMoveUp} icon={<IconUp />} onClick={() => onMoveUp(action.id)} /></Child>
            <Child padding="0 0 0 1rem"><IconButton disabled={!onMoveDown} icon={<IconDown />} onClick={() => onMoveDown(action.id)} /></Child>
            <Child padding="0 1rem 0 1rem"><VerticalPipe /></Child>
            <Child padding="0"><IconButton onClick={() => setExpanded(true)} icon={<IconEdit />} /></Child>
          </>}
        </Split>
      </PillHeader>
      {showBody && <Split direction="column" padding="1rem">
        <Child>
          <Split>
            <Row title="">
              <Split direction="row">
                <Child padding="0 1rem 0 0">
                  <Switch
                    value={wait}
                    onChange={setWait}
                  />
                </Child>
                <Child grow>
                  <span>Await execution of this action</span>
                </Child>
              </Split>
            </Row>
            <Row title="Voice:">
              <Select
                value={voice}
                onChange={(e) => setVoice(voices.find(v => v.voiceURI === e.target.value)?.voiceURI)}
              >
               {voices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.localService ? v.lang : `${v.lang} *`})</option>)}
              </Select>
            </Row>
            <Row title="Text:">
              <Input value={text} onChange={e => setText(e.target.value)} />
            </Row>
          </Split>
        </Child>
      </Split>}
    </PillBorder>
  )
}

TextToSpeechPill.defaultProps = {
  expanded: false,
  onChange: () => {},
  onRemove: () => {},
}