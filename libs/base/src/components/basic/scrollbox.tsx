import styled from 'styled-components';

import { Outer } from './layout';

export const ScrollBox = styled(Outer)`
  flex: 1 1 auto;
  overflow-y: auto;
  min-height: 0px;
  max-height: 100%;
    
  &::-webkit-scrollbar {
    width: 1rem;
    background-color: transparent;
  }

  &::-webkit-scrollbar-thumb:vertical {
    background: rgba(255, 255, 255, 0.1);
    background-clip: padding-box;
    border-radius: 999rem;
    border: 0.2rem solid transparent;
    min-height: 1rem;
  }
  &::-webkit-scrollbar-thumb:vertical:active {
    background: rgba(255, 255, 255, 0.2);
    background-clip: padding-box;
    border-radius: 999rem;
    border: 0.2rem solid transparent;
  }
`