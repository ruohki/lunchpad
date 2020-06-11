import * as React from 'react';
import * as _ from 'lodash';

import { PlaySound, IMediaDevice } from '@lunchpad/types';
import { useAnimationFrame } from '@lunchpad/hooks';
import { IconPlay, IconStop, IconVolumeUp } from '@lunchpad/icons';
import { FileURI } from '@lunchpad/types';

import { AudioRange } from '../audiorange';
import { Pill } from './pill'
import { Split, Child, Row } from '../basic/layout';
import { IconButton, Slider, File, Select, Switch } from '../basic';

const path = window.require('path')

type MoveFN = (id: string) => void

interface IPlaySoundPill {
  action: PlaySound
  outputDevices: IMediaDevice[]
  expanded?: boolean
  onChange?: (action: PlaySound) => void
  onRemove?: (id: string) => void
  onMoveUp: MoveFN | undefined
  onMoveDown: MoveFN | undefined
}

interface AudioBufferSourceNodeExtra extends AudioBufferSourceNode {
  offset: number
  startTime: number
}

const audio = new AudioContext();

export const PlaySoundPill: React.SFC<IPlaySoundPill> = ({ action, expanded, outputDevices, onChange, onRemove, onMoveUp, onMoveDown }) => {
  const [ showBody, setExpanded ] = React.useState<boolean>(expanded);

  const [ audioBuffer, setAudioBuffer ] = React.useState<AudioBuffer>();
  const [ player, setPlayer ] = React.useState<AudioBufferSourceNodeExtra>();
  const [ playbackPos, setPlaybackPos ] = React.useState<number>(0);
  const [ playing, setPlaying ] = React.useState<boolean>(false);
  
  const filename = path.basename(action.soundfile) || "none";

  const setProp = (props) => {
    onChange(Object.assign({}, action, props))
  }
  
  const StopBuffer = () => {
    if (player) {
      player.stop();
      player.disconnect();
    }
    setPlaying(false);
  }

  const PlayBuffer = () => {
    if (!audioBuffer) return;
    StopBuffer();

    const gainNode = audio.createGain();
    gainNode.gain.value = action.volume;
    gainNode.connect(audio.destination);

    const bufferSource = audio.createBufferSource() as AudioBufferSourceNodeExtra;
    bufferSource.buffer = audioBuffer;
    bufferSource.connect(gainNode);

    const start = audioBuffer.duration * action.start
    const duration = audioBuffer.duration * action.end - start
    
    setPlaying(true);

    bufferSource.start(0, start, duration);
    bufferSource.offset = start;
    bufferSource.startTime = audio.currentTime;
    bufferSource.addEventListener('ended', () => setPlaying(false));

    setPlayer(bufferSource);
  };

  useAnimationFrame(deltaTime => {
    if (!playing) return;
    if (player.context.currentTime === 0) return;
    const offset = player.offset / audioBuffer.duration
    const pos = _.clamp(((player.context.currentTime - player.startTime) / audioBuffer.duration ) + offset, 0, 1);
    setPlaybackPos(_.clamp(pos, action.start, action.end))
  });

  React.useEffect(() => {
    fetch(FileURI(action.soundfile))
      .then(response => response.arrayBuffer())
      .then(arrayBuffer => audio.decodeAudioData(arrayBuffer))
      .then(setAudioBuffer);
  }, [ action.soundfile ])

  const Collapsed = (
    <Split direction="row">
      <Child grow basis="75%" whiteSpace="nowrap" padding="0 1rem 0 0"><div style={{textOverflow: "ellipsis", overflow: "hidden"}}>Play: {filename}</div></Child>
      <Child grow basis="25%">
        <Slider
          value={action.volume * 100}
          onChange={(e) => setProp({ volume: (parseInt(e.target.value) / 100)})}
        />
      </Child>
      <Child padding="0 0 0 1rem">{Math.round(action.volume * 100)}%</Child>
      {!playing && <Child padding="0 0 0 1rem"><IconButton icon={<IconPlay />} onClick={(e) => PlayBuffer()} /></Child>}
      {playing && <Child padding="0 0 0 1rem"><IconButton icon={<IconStop />} onClick={() => StopBuffer()} /></Child>}
    </Split>
  )

  const Expanded = (
    <Split direction="row">
      <Child grow whiteSpace="nowrap" padding="0 1rem 0 0"><div style={{textOverflow: "ellipsis", overflow: "hidden"}}>Play: {filename}</div></Child>
    </Split>
  )

  return (
    <Pill
      isExpanded={showBody}
      icon={<IconVolumeUp />}
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
                onChange={(wait) => setProp({ wait })}
              />
            </Child>
            <Child grow>
              <span>Await execution of this action</span>
            </Child>
          </Split>
        </Row>
        <Row title="Sound:">
          <File value={action.soundfile} accept="audio/*" onChange={f => {
            setProp({ start: 0, end: 1, soundfile: f})
            console.log("Change")
            setPlaybackPos(0);
          }} />
        </Row>
        <Row title="Sound Output">
          <Select
            value={action.outputDevice}
            onChange={e => setProp({ outputDevice: e.target.value })}
          >
            {outputDevices.map(e => <option key={e.deviceId} value={e.deviceId}>{e.label}</option>)}
          </Select>
        </Row>
        <Row title="Volume:">
          <Split direction="row">
            <Child grow>
              <Slider value={action.volume * 100} onChange={(e) => setProp({ volume: parseInt(e.target.value) / 100})} />
            </Child>
            <Child padding="0 0 0 1rem">
              {Math.round(action.volume * 100)}%
            </Child>
            {!playing && <Child padding="0 0 0 1rem">
              <IconButton icon={<IconPlay />} onClick={() => PlayBuffer()} />
            </Child>}
            {playing && <Child padding="0 0 0 1rem">
              <IconButton icon={<IconStop />} onClick={() => StopBuffer()}/>
            </Child>}
          </Split>
        </Row>
        <Row title="In/Out:">
          <AudioRange
            onChange={(start, end) => {
              setProp({ start, end })
              setPlaybackPos(start)
            }}
            file={FileURI(action.soundfile)}
            playbackPos={playbackPos}
            start={action.start}
            end={action.end}
          />
        </Row>
        <Row title="">
          <span style={{float:'left'}}><IconPlay /> {((audioBuffer?.duration ?? 0) * action.start).toFixed(2)}s ({Math.round(action.start * 100)}%)</span>
          <span style={{float:'right'}}><IconStop /> {((audioBuffer?.duration ?? 0) * action.end).toFixed(2)}s ({Math.round(action.end * 100)}%)</span>
        </Row>
      </Split>
    </Pill>
  )
}

PlaySoundPill.defaultProps = {
  expanded: false,
  onChange: () => {},
  onRemove: () => {},
}