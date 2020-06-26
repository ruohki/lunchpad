import styled from 'styled-components';
import Circle from "react-color/lib/Circle";

export const PickerContainer = styled.div`
  display: block;
  position: absolute;
  left: 20px;
  top: 20px;
  width: 400px;
  height: calc(200px + 3rem);
  border-radius: 4px;
  background-color: var(--COLOR_MENU);
  box-shadow: 0 0 5px 3px #0000007f;
  overflow: hidden;
`;

export const SaturationCursor = styled.div`
  box-shadow: 0 0 5px 1px #000;
  display: block;
  width: 1rem;
  height: 1rem;
  transform: translate(-50%, -50%);
  border-radius: 999px;

  border: 1px solid var(--COLOR_BLURPLE);
`;

export const HueCursor = styled.div`
  box-shadow: 0 0 5px 1px #000;
  display: block;
  min-width: 0.5rem;
  height: 1rem;
  transform: translate(-50%, 0);
  border-radius: 1px;
`;

export const StyledCircle = styled(Circle)`
  justify-content: space-between;

  & > span {
    transform: translatex(25%);
    & > div {
      margin-right: 1rem !important;
      margin-bottom: 0.9rem !important;
    }
  }
`;

export const ColorPickerElementWrapper = styled.div`
  box-sizing: border-box;
  border: 2px solid var(--COLOR_NOTBLACK);
  border-radius: 4px;
  overflow: hidden;
  width: 100%;
  height: 100%;
  position: relative;
`