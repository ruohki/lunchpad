import React from "react";
import _ from "lodash";

import { PlaybackPosition, RangeContainer, Container, RangeLeft, GrabberLeft, RangeMiddle, RangeRight, GrabberRight } from "./components";

interface IWaveForm {
  file: string
}

interface IAudioRange {
  file: string
  playbackPos?: number
  duration?: number
  start?: number
  end?: number
  onChange?(start: number, end: number): void
}

const audioContext = new AudioContext();

const filterData = (audioBuffer, samples = 140) => {
  const rawData = audioBuffer.getChannelData(0);

  const blockSize = Math.floor(rawData.length / samples);
  const filteredData = [];
  for (let i = 0; i < samples; i++) {
    let blockStart = blockSize * i;
    let sum = 0;
    for (let j = 0; j < blockSize; j++) {
      sum = sum + Math.abs(rawData[blockStart + j]);
    }
    filteredData.push(sum / blockSize);
  }
  return filteredData;
};

const normalizeData = filteredData => {
  const multiplier = Math.pow(Math.max(...filteredData), -1);
  return filteredData.map(n => n * multiplier);
};

const drawBar = (ctx: CanvasRenderingContext2D, upperLeftCornerX: number, upperLeftCornerY: number, width: number, height: number, color: string) =>  {
  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(upperLeftCornerX, upperLeftCornerY, width, height);
  ctx.restore();
}

export const WaveForm: React.SFC<IWaveForm> = ({ file }) => {
  const ref = React.useRef<HTMLCanvasElement>();

  React.useEffect(() => {
    const canvas = ref.current;
    const context = canvas.getContext("2d");

    context.clearRect(0, 0, canvas.width, canvas.height);

    fetch(file)
      .then(response => response.arrayBuffer())
      .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
      .then(audioBuffer => {
        const samples = 1000;
        const data = normalizeData(filterData(audioBuffer, samples));

        const width = canvas.width / samples;

        drawBar(context, 0, 50, 1000, 2, "#ff0000");
        data.forEach((d, i) => {
          let height = d * 100;
          height = height < 1 ? 1 : height;
          height = height > 99 ? 99 : height;

          let offset = 49 - height / 2;

          drawBar(
            context,
            i * width,
            100 - height - offset,
            width,
            height,
            "#ff0000"
          );
        });
      });
  }, [file]);

  return (
    <canvas
      ref={ref}
      height="100px"
      width="1000px"
      style={{
        borderRadius: "8px",
        height: "48px",
        width: "100%",
        backgroundColor: "#202020"
      }}
    />
  );
};



export const AudioRange: React.SFC<IAudioRange> = ({ file, start, end, playbackPos, onChange }) => {
  const [draggingLeft, setDraggingLeft] = React.useState(false);
  const [draggingRight, setDraggingRight] = React.useState(false);

  const [inMark, setInMark] = React.useState(start);
  const [outMark, setOutMark] = React.useState(100 - end);

  const ref = React.useRef<HTMLDivElement>();

  const mouseMove = e => {
    if (e.buttons !== 1) return;
    const offsetX = ref.current.getBoundingClientRect().left;
    if (draggingLeft) {
      const val = _.clamp(
        ((e.clientX - offsetX) / ref.current.clientWidth) * 100,
        0,
        100 - outMark
      );
      setInMark(val);
    } else if (draggingRight) {
      const val = _.clamp(
        ((e.clientX - offsetX) / ref.current.clientWidth) * 100,
        inMark,
        100
      );
      setOutMark(100 - val);
    }
  };

  React.useEffect(() => {
    const onMouseUp = () => {
      setDraggingLeft(false);
      setDraggingRight(false);
      onChange(inMark, 100 - outMark);
    };
    window.addEventListener("mouseup", onMouseUp);

    return () => window.removeEventListener("mouseup", onMouseUp);
  }, [inMark, outMark, setDraggingLeft, setDraggingRight]);

  return (
    <div ref={ref}>
      <Container  onMouseMove={mouseMove}>
        <RangeContainer>
          <RangeLeft style={{ width: `${inMark}%` }}>
            <GrabberLeft onMouseDown={() => setDraggingLeft(true)} />
          </RangeLeft>
          <RangeMiddle
            style={{ width: `${100 - (inMark + outMark)}%` }}
          />
          <RangeRight style={{ width: `${outMark}%` }}>
            <GrabberRight onMouseDown={() => setDraggingRight(true)} />
          </RangeRight>
        </RangeContainer>
        <PlaybackPosition style={{ marginLeft: `${playbackPos}%` }} />
        <WaveForm file={file} />
      </Container>
    </div>
  );
};

AudioRange.defaultProps = {
  start: 0,
  end: 100,
  playbackPos: 0,
  onChange: () => {}
}