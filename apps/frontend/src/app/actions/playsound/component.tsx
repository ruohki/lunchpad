import * as React from 'react';
import lodash from 'lodash';

import { IMediaDevice, settingsLabels } from '@lunchpad/types';
import { useAnimationFrame, useLocalStorage } from '@lunchpad/hooks';
import { Icon, TriangleRight, Rectangle, Sound } from '@lunchpad/icons';
import { FileURI } from '@lunchpad/types';

import { AudioRange, Split, Child, Row, IconButton, Slider, File, Select, Switch  } from '@lunchpad/base';
import Pill from '../pill'
import { PlaySound } from './classes';
import { AudioContext } from '@lunchpad/contexts';

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

export const PlaySoundPill: React.SFC<IPlaySoundPill> = (props) => {
  const [ showBody, setExpanded ] = React.useState<boolean>(props.expanded);
  const { audio } = React.useContext(AudioContext.Context);
  const [ defaultOutput ] = useLocalStorage<string>(settingsLabels.soundOutput, "default");

  const [ audioBuffer, setAudioBuffer ] = React.useState<AudioBuffer>();
  const [ player, setPlayer ] = React.useState<AudioBufferSourceNodeExtra>();
  const [ playbackPos, setPlaybackPos ] = React.useState<number>(0);
  const [ playing, setPlaying ] = React.useState<boolean>(false);
  
  const filename = path.basename(props.action.soundfile ?? "file://none")
  
  const setProp = (prop) => {
    props.onChange(Object.assign(props.action, prop))
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
    
    gainNode.gain.value = props.action.volume;
    gainNode.connect(audio.destination);

    const bufferSource = audio.createBufferSource() as AudioBufferSourceNodeExtra;
    bufferSource.buffer = audioBuffer;
    bufferSource.connect(gainNode);

    const start = audioBuffer.duration * props.action.start
    const duration = audioBuffer.duration * props.action.end - start
    
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
    const pos = lodash.clamp(((player.context.currentTime - player.startTime) / audioBuffer.duration ) + offset, 0, 1);
    setPlaybackPos(lodash.clamp(pos, props.action.start, props.action.end))
  });

  React.useEffect(() => {
    if (!props.action.soundfile) return;
    fetch(FileURI(props.action.soundfile))
      .then(response => response.arrayBuffer())
      .then(arrayBuffer => audio.decodeAudioData(arrayBuffer))
      .then(buffer => {
        setProp({ duration: buffer.duration })
        setAudioBuffer(buffer)
      });
  }, [ props.action.soundfile ])

  const rangeToVol = (value) => value <= 50 ? value / 50 : (((value - 50) / 50) * 19) + 1
  const volToRange = (volume) => volume <= 1 ? (volume * 100) / 2 : (((volume - 1) / 19) * 50) + 50

  const Collapsed = (
    <Split direction="row">
      <Child grow basis="75%" whiteSpace="nowrap" padding="0 1rem 0 0"><div style={{textOverflow: "ellipsis", overflow: "hidden"}}>Play: {lodash.truncate(filename, { length: 30})}</div></Child>
      <Child grow basis="25%">
        <Slider
          value={volToRange(props.action.volume)}
          onChange={(e) => setProp({ volume: (rangeToVol(e.target.value))})}
        />
      </Child>
      <Child padding="0 0 0 1rem">{Math.round(volToRange(props.action.volume) * 2)}%</Child>
      {!playing && <Child padding="0 0 0 1rem"><IconButton icon={<Icon icon={TriangleRight} />} onClick={(e) => PlayBuffer()} /></Child>}
      {playing && <Child padding="0 0 0 1rem"><IconButton icon={<Icon icon={Rectangle} />} onClick={() => StopBuffer()} /></Child>}
    </Split>
  )

  const Expanded = (
    <Split direction="row">
      <Child grow whiteSpace="nowrap" padding="0 1rem 0 0"><div style={{textOverflow: "ellipsis", overflow: "hidden"}}>Play: {lodash.truncate(filename, { length: 45})}</div></Child>
    </Split>
  )

  return (
    <Pill
      isExpanded={showBody}
      icon={<Icon icon={Sound} />}
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
                onChange={(wait) => setProp({ wait })}
              />
            </Child>
            <Child grow>
              <span>Await execution of this action</span>
            </Child>
          </Split>
        </Row>
        <Row title="Sound:">
          <File value={props.action.soundfile} accept="audio/*" onChange={f => {
            setProp({ start: 0, end: 1, soundfile: f})
            console.log("Change")
            setPlaybackPos(0);
          }} />
        </Row>
        <Row title="Sound Output">
          <Select
            value={props.action.outputDevice}
            onChange={e => setProp({ outputDevice: e.target.value })}
          >
            <option value="inherit">Lunchpad Default ({props.outputDevices.find(d => d.deviceId === defaultOutput)?.label})</option>
            {props.outputDevices.map(e => <option key={e.deviceId} value={e.deviceId}>{e.label}</option>)}
          </Select>
        </Row>
        <Row title="Volume:">
          <Split direction="row">
            <Child grow>
              <Slider value={volToRange(props.action.volume)} onChange={(e) => setProp({ volume: rangeToVol(e.target.value) })} />
            </Child>
            <Child padding="0 0 0 1rem">
              {Math.round(volToRange(props.action.volume) * 2)}%
            </Child>
            {!playing && <Child padding="0 0 0 1rem">
              <IconButton icon={<Icon icon={TriangleRight} />} onClick={() => PlayBuffer()} />
            </Child>}
            {playing && <Child padding="0 0 0 1rem">
              <IconButton icon={<Icon icon={Rectangle} />} onClick={() => StopBuffer()}/>
            </Child>}
          </Split>
        </Row>
        <Row title="In/Out:">
          <AudioRange
            onChange={(start, end) => {
              setProp({ start, end })
              setPlaybackPos(start)
            }}
            file={FileURI(props.action.soundfile)}
            playbackPos={playbackPos}
            start={props.action.start}
            end={props.action.end}
          />
        </Row>
        <Row title="">
          <span style={{float:'left'}}><Icon icon={TriangleRight} /> {((audioBuffer?.duration ?? 0) * props.action.start).toFixed(2)}s ({Math.round(props.action.start * 100)}%)</span>
          <span style={{float:'right'}}><Icon icon={Rectangle} /> {((audioBuffer?.duration ?? 0) * props.action.end).toFixed(2)}s ({Math.round(props.action.end * 100)}%)</span>
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