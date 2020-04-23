
import { createGlobalStyle } from 'styled-components';

export const COLOR_BLURPLE = "#7289DA";
export const COLOR_WHITE = "#ffffff";
export const COLOR_GREYPLE = "#99AAB5";
export const COLOR_GRAY = "#76787b";
export const COLOR_DARK = "#42464C";
export const COLOR_DARKER = "#2C2F33";
export const COLOR_NOTBLACK = "#23272A";
export const COLOR_YETNOTBLACK = "#171717";
export const COLOR_MENU = "#151515"
export const COLOR_ALMOSTBLACK = "hsla(0, 0%, 10%, 1)";
export const COLOR_BLACK = "hsla(0, 0%, 5%, 1)";
export const COLOR_REDISH = "#EC4343";

const Global = createGlobalStyle`
  :root {
    --width: ${() => document.documentElement.clientWidth}px;
    --height: ${() => document.documentElement.clientHeight}px;
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

  button {
    font-family: "Exo 2";
    font-size: 1.6rem;
  }
`;

export default Global;

