import React from 'react';

import Select from '../Basic/select';

import { Backdrop, Container } from './components';

export default ({ visible }) => {
  return /* visible ? */ (
    <Backdrop>
      <Container>
        <div>
          <h3>Settings</h3>
        </div>
        <div>
          <div>
            <div>
              Operation Mode
            </div>
            <div>
              <Select>
                <option>A</option>
                <option>B</option>
                <option>C</option>
              </Select>
            </div>
          </div>
          <div>
            <div>
              Operation Mode
            </div>
            <div>
              <Select>
                <option>A</option>
                <option>B</option>
                <option>C</option>
              </Select>
            </div>
            </div>
        </div>
        <div>C</div>
      </Container>
    </Backdrop>
  ) /* : (
    <></>
  ) */
}