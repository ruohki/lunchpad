import React from 'react';
import styled from 'styled-components';

export const Container = styled.div`
  width: 100%;
  height: 100%;
  display: grid;
  grid-gap: 0;
  grid-template-columns: repeat(6, [col] calc(100% / 6));
  grid-template-rows: repeat(6, [row] calc(100% / 6));

  justify-content: center;
`;