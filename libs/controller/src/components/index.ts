import styled from 'styled-components';

interface IPadContainer {
  width: number
  height: number
}

export const PadContainer = styled.div<IPadContainer>`
  width: 100%;
  height: 100%;
  display: grid;
  grid-gap: 0;
  grid-template-columns: repeat(${props => props.width}, [col] calc(100% / ${props => props.width}));
  grid-template-rows: repeat(${props => props.height}, [row] calc(100% / ${props => props.height}));

  justify-content: center;
`;