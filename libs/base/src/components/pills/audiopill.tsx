import * as React from 'react';
import * as _ from 'lodash';

import { PlaySound, IMediaDevice } from '@lunchpad/types';
import { useAnimationFrame } from '@lunchpad/hooks';
import { IconPlay, IconStop, IconEdit, IconTimes, IconCheck, IconTrash, IconUp, IconDown, IconVolumeUp } from '@lunchpad/icons';
import { FileURI } from '@lunchpad/types';

import { AudioRange } from '../audiorange';
import { PillHeader, PillBorder } from './pill'
import { Split, Child, VerticalPipe, Row } from '../basic/layout';
import { IconButton, Slider, File, Tooltip, Select, Switch } from '../basic';
import { COLOR_REDISH, COLOR_BLURPLE } from '../../theme';

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
  const [ file, setFile ] = React.useState<string>(action.soundfile || "");
  
  const [ audioBuffer, setAudioBuffer ] = React.useState<AudioBuffer>();
  
  const [ player, setPlayer ] = React.useState<AudioBufferSourceNodeExtra>();

  const [ playbackRange, setPlaybackRange ] = React.useState<[number, number]>([action.start, action.end]);
  const [ playbackPos, setPlaybackPos ] = React.useState<number>(0);
  const [ playing, setPlaying ] = React.useState<boolean>(false);

  const [ volume, setVolume ] = React.useState<number>(action.volume);
  const [ outputDevice, setOutputDevice ] = React.useState(action.outputDevice);

  const filename = path.basename(file) || "none";
  const [ inMark, outMark ] = playbackRange;

  const [ wait, setWait ] = React.useState<boolean>(action.wait);

  const change = () => {
    const actn = new PlaySound(file)
    actn.id = action.id;
    actn.volume = volume;
    actn.start = inMark;
    actn.end = outMark;
    actn.outputDevice = outputDevice;
    actn.wait = wait;

    onChange(actn)
    setExpanded(false);
  }

  const onAudioRangeChange = (start: number, end: number) => {
    setPlaybackPos(start);
    setPlaybackRange([start, end]);
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
    gainNode.gain.value = volume;
    gainNode.connect(audio.destination);

    const bufferSource = audio.createBufferSource() as AudioBufferSourceNodeExtra;
    bufferSource.buffer = audioBuffer;
    bufferSource.connect(gainNode);

    const start = audioBuffer.duration * inMark
    const duration = audioBuffer.duration * outMark - start
    
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
    setPlaybackPos(pos)
  });

  React.useEffect(() => {
    fetch(FileURI(file))
      .then(response => response.arrayBuffer())
      .then(arrayBuffer => audio.decodeAudioData(arrayBuffer))
      .then(setAudioBuffer);
  }, [ file ])

  return (
    <PillBorder show={showBody}>
      <PillHeader expanded={showBody}>
        <Split direction="row">
         <Child padding={"0 1rem 0 0"}><IconVolumeUp /></Child>
          {showBody ? <>
            <Child grow width="40%" whiteSpace="nowrap"><div style={{textOverflow: "ellipsis", overflow: "hidden"}}>Edit: Play sound file</div></Child>
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
            <Child grow width="50%" whiteSpace="nowrap"><div style={{textOverflow: "ellipsis", overflow: "hidden"}}>Play: {filename}</div></Child>
            <Child grow padding="0">
              <Split direction="row">
                <Child grow>
                  <Slider
                    value={volume * 100}
                    onChange={(e) => setVolume(parseInt(e.target.value) / 100)}
                    onMouseUp={change
                    }
                  />
                </Child>
                <Child padding="0 0 0 1rem">{Math.round(volume * 100)}%</Child>
                {!playing && <Child padding="0 0 0 1rem"><IconButton icon={<IconPlay />} onClick={() => PlayBuffer()} /></Child>}
                {playing && <Child padding="0 0 0 1rem"><IconButton icon={<IconStop />} onClick={() => StopBuffer()} /></Child>}
                <Child padding="0 1rem 0 1rem"><VerticalPipe /></Child>
                <Child padding="0"><IconButton disabled={!onMoveUp} icon={<IconUp />} onClick={() => onMoveUp(action.id)} /></Child>
                <Child padding="0 0 0 1rem"><IconButton disabled={!onMoveDown} icon={<IconDown />} onClick={() => onMoveDown(action.id)} /></Child>
                <Child padding="0 1rem 0 1rem"><VerticalPipe /></Child>
                <Child padding="0"><IconButton onClick={() => setExpanded(true)} icon={<IconEdit />} /></Child>
              </Split>
            </Child>
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
            <Row title="Sound:">
              <File value={file} accept="audio/*" onChange={f => {
                setPlaybackRange([0, 1]);
                setPlaybackPos(0);
                setFile(f)
              }} />
            </Row>
            <Row title="Sound Output">
              <Select
                value={outputDevice}
                onChange={e => setOutputDevice(e.target.value)}
              >
                {outputDevices.map(e => <option key={e.deviceId} value={e.deviceId}>{e.label}</option>)}
              </Select>
            </Row>
            <Row title="Volume:">
              <Split direction="row">
                <Child grow>
                  <Slider value={volume * 100} onChange={(e) => setVolume(parseInt(e.target.value) / 100)} />
                </Child>
                <Child padding="0 0 0 1rem">
                  {Math.round(volume * 100)}%
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
              <AudioRange onChange={onAudioRangeChange} file={FileURI(file)} playbackPos={playbackPos} start={inMark} end={outMark} />
            </Row>
            <Row title="">
              <span style={{float:'left'}}><IconPlay /> {((audioBuffer?.duration ?? 0) * inMark).toFixed(2)}s ({Math.round(inMark * 100)}%)</span>
              <span style={{float:'right'}}><IconStop /> {((audioBuffer?.duration ?? 0) * outMark).toFixed(2)}s ({Math.round(outMark * 100)}%)</span>
            </Row>
          </Split>
        </Child>
      </Split>}
    </PillBorder>
  )
}

PlaySoundPill.defaultProps = {
  expanded: false,
  onChange: () => {},
  onRemove: () => {},
}