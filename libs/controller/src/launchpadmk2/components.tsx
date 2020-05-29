import React from 'react';
import styled from 'styled-components';

export const Container = styled.div`
  width: 100%;
  height: 100%;
  display: grid;
  grid-gap: 0;
  grid-template-columns: repeat(9, [col] calc(100% / 9));
  grid-template-rows: repeat(9, [row] calc(100% / 9));

  justify-content: center;
`;