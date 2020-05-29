import * as React from 'react';
import * as _ from 'lodash';

import { PlaySound } from '@lunchpad/types';
import { IconPlay, IconStop, IconEdit, IconTimes, IconCheck, IconTrash, IconUp, IconDown } from '@lunchpad/icons';

import { AudioRange } from '../audiorange';
import { PillHeader, PillBorder } from './pill'
import { Split, Child, VerticalPipe, Row } from '../basic/layout';
import { IconButton, Slider, File, Tooltip } from '../basic';
import { COLOR_REDISH, COLOR_BLURPLE } from '../../theme';

const path = window.require('path')

interface IPlaySoundPill {
  action: PlaySound
  onChange: (action: PlaySound) => void
  onRemove: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
}

interface AudioBufferSourceNodeExtra extends AudioBufferSourceNode {
  offset: number
  startTime: number
}

const useAnimationFrame = callback => {
  const requestRef = React.useRef<number>();
  const previousTimeRef = React.useRef<number>();

  React.useEffect(() => {
    const animate = time => {
      if (previousTimeRef.current !== undefined) {
        const deltaTime = time - previousTimeRef.current;
        callback(deltaTime);
      }
      previousTimeRef.current = time;
      requestRef.current = requestAnimationFrame(animate);
    };
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  });
};

const audio = new AudioContext();

export const PlaySoundPill: React.SFC<IPlaySoundPill> = ({ action, onChange, onRemove, onMoveUp, onMoveDown }) => {
  const [ expanded, setExpanded ] = React.useState<boolean>(false);
  const [ file, setFile ] = React.useState<string>(action.soundfile || "");
  
  const [ audioBuffer, setAudioBuffer ] = React.useState<AudioBuffer>();
  
  const [ player, setPlayer ] = React.useState<AudioBufferSourceNodeExtra>();

  const [ playbackRange, setPlaybackRange ] = React.useState<[number, number]>([action.start, action.end]);
  const [ playbackPos, setPlaybackPos ] = React.useState<number>(0);
  const [ playing, setPlaying ] = React.useState<boolean>(false);

  const [ volume, setVolume ] = React.useState<number>(action.volume);

  const filename = path.basename(file) || "none";
  const [ inMark, outMark ] = playbackRange;

  const change = () => {
    const actn = new PlaySound(
      file,
      volume,
      inMark,
      outMark,
    )
    actn.id = action.id;

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

    const start = audioBuffer.duration * (inMark / 100)
    const duration = audioBuffer.duration * (outMark / 100) - start
    
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
    const offset = player.offset / audioBuffer.duration * 100
    const pos = _.clamp(((player.context.currentTime - player.startTime) / audioBuffer.duration ) * 100 + offset, 0, 100);
    setPlaybackPos(pos)
  });

  React.useEffect(() => {
    fetch(file)
      .then(response => response.arrayBuffer())
      .then(arrayBuffer => audio.decodeAudioData(arrayBuffer))
      .then(setAudioBuffer);
  }, [ file ])

  return (
    <PillBorder show={expanded}>
      <PillHeader expanded={expanded}>
        <Split direction="row">
          {expanded ? <>
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
                <Child padding="0"><IconButton icon={<IconUp />} onClick={() => onMoveUp(action.id)} /></Child>
                <Child padding="0 0 0 1rem"><IconButton icon={<IconDown />} onClick={() => onMoveDown(action.id)} /></Child>
                <Child padding="0 1rem 0 1rem"><VerticalPipe /></Child>
                <Child padding="0"><IconButton onClick={() => setExpanded(true)} icon={<IconEdit />} /></Child>
              </Split>
            </Child>
          </>}
        </Split>
      </PillHeader>
      {expanded && <Split direction="column" padding="1rem">
        <Child>
          <Split>
            <Row title="Sound:">
              <File value={file} onChange={f => setFile(f)} />
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
              <AudioRange onChange={onAudioRangeChange} file={file} playbackPos={playbackPos} start={inMark} end={outMark} />
            </Row>
            <Row title="">
              <span style={{float:'left'}}><IconPlay /> {(audioBuffer.duration * (inMark / 100)).toFixed(2)}s ({Math.round(inMark)}%)</span>
              <span style={{float:'right'}}><IconStop /> {(audioBuffer.duration * (outMark / 100)).toFixed(2)}s ({Math.round(outMark)}%)</span>
            </Row>
          </Split>
        </Child>
      </Split>}
    </PillBorder>
  )
}

PlaySoundPill.defaultProps = {
  onChange: () => {},
  onRemove: () => {},
  onMoveUp: () => {},
  onMoveDown: () => {}
}