import styled from 'styled-components';

export const Container = styled.div`
  position: relative;
  border-radius: 8px;
  height: 48px;
  overflow: hidden;
`;

export const PlaybackPosition = styled.div`
  pointer-events: none;
  position: absolute;
  float: left;
  margin-left: 33%;
  height: 100%;
  width: 1px;
  background-color: rgb(0,255,0,0.75);
`;

export const RangeContainer = styled.div`
  position: absolute;
  height: 100%;
  width: 100%;
`;

export const RangeLeft = styled.div`
  float: left;
  height: 100%;
  width: 100%;
  background-color: rgb(0, 0, 0, 0.55);
`;

export const GrabberLeft = styled.div`
  position: relative;
  float: right;
  height: 100%;
  width: 4px;
  background-color: #ecececcf;
  user-select: none;
  cursor: ew-resize;
  border-radius: 8px;
  margin-right: -4px;
`;

export const RangeMiddle = styled.div`
  float: left;
  height: 100%;
  width: 100%;
`;

export const RangeRight = styled.div`
  float: left;
  height: 100%;
  width: 100%;
  background-color: rgb(0, 0, 0, 0.55);
`;

export const GrabberRight = styled.div`
  position: relative;
  float: left;
  height: 100%;
  width: 4px;
  background-color: #ecececcf;
  user-select: none;
  cursor: ew-resize;
  border-radius: 8px;
  margin-left: -2px;
`;