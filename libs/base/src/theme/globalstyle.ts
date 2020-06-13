
import 'react-tippy/dist/tippy.css'

import { createGlobalStyle } from 'styled-components';
import { COLOR_ALMOSTBLACK } from './colors';


export const GlobalStyle = createGlobalStyle`
  :root {
    --width: ${() => document.documentElement.clientWidth}px;
    --height: ${() => document.documentElement.clientHeight}px;
    --COLOR_BLURPLE: #7289DA;
    --COLOR_WHITE: #ffffff;
    --COLOR_GREYPLE: #99AAB5;
    --COLOR_GRAY: #76787b;
    --COLOR_DARK: #42464C;
    --COLOR_DARKER: #2C2F33;
    --COLOR_NOTBLACK: #23272A;
    --COLOR_YETNOTBLACK: #171717;
    --COLOR_MENU: #151515;
    --COLOR_ALMOSTBLACK: hsla(0, 0%, 10%, 1);
    --COLOR_BLACK: hsla(0, 0%, 5%, 1);
    --COLOR_REDISH: #EC4343;
  }

  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  html {
    font-size: 62.5%;
    user-select: none;
  }

  body {
    font-family: "Exo 2";
    background-color: ${COLOR_ALMOSTBLACK};
    color: white;
    font-size: 1.6rem;
  }

  svg {
    fill: currentColor !important;
  }

  button {
    font-family: "Exo 2";
    font-size: 1.6rem;
  }

  input {
    font-family: "Exo 2";
    font-size: 1.6rem;
  }

  .tooltip {
    font-family: "Exo 2" !important;
    font-size: 1.6rem !important;

    & > * {
      background-color: var(--COLOR_REDISH) !important;
    }
  }

  .tooltip-button {
    width: 100%;
    height: 100%;
  }
`;
