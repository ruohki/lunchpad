import React from 'react';
import styled from 'styled-components';
import { COLOR_NOTBLACK, COLOR_ALMOSTBLACK, COLOR_WHITE } from '../gobalStyle';


const Select = styled.select`
  appearance: none;  
  display: block;
  width: 100%;

  padding: 8px 10px 6px 10px;

  color: ${COLOR_WHITE};
  background-color: ${COLOR_NOTBLACK};
  border: 2px solid ${COLOR_ALMOSTBLACK};
  
  border-radius: 7px;
  
  font-size: 1.6rem;
  font-weight: normal;
  font-style: normal;
  
  outline: 0px;

  background-image: url("data:image/svg+xml;utf8,<svg fill='white' height='16' viewBox='0 0 24 16' width='24' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/><path d='M0 0h24v24H0z' fill='none'/></svg>");
  background-repeat: no-repeat;
  background-position-x: 99%;
  background-position-y: 3px;
`

export default Select;