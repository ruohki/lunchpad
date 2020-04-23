import React from 'react';

import { Backdrop, Container } from './components';

export default ({ visible }) => {
  return visible ? (
    <Backdrop>
      <Container>
        <div>A</div>
        <div>B</div>
        <div>C</div>
      </Container>
    </Backdrop>
  ) : (
    <></>
  )
}