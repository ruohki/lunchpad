import * as React from 'react';
import { createGlobalStyle } from 'styled-components';

export const COLOR_BLUEISH = "color-blueish";
export const COLOR_WHITE = "color-white";
export const COLOR_GREYPLE = "color-greyple";
export const COLOR_GRAY = "color-gray";
export const COLOR_DARK = "color-dark";
export const COLOR_DARKER = "color-darker";
export const COLOR_NOTBLACK = "color-not-black";
export const COLOR_YETNOTBLACK = "color-yet-not-black";
export const COLOR_MENU = "color-menu"
export const COLOR_ALMOSTBLACK = "color-almost-black";
export const COLOR_BLACK = "color-black";
export const COLOR_REDISH = "color-redish";
export const COLOR_GREENISH = "color-greenish";

const csscolor = (color: string): string => `var(--${color})`;

export const GlobalStyle = createGlobalStyle`
  :root {
    --width: ${() => document.documentElement.clientWidth}px;
    --height: ${() => document.documentElement.clientHeight}px;
    
    --${COLOR_WHITE}: #ffffff;
    --${COLOR_GREYPLE}: #99AAB5;
    --${COLOR_GRAY}: #76787b;
    --${COLOR_DARK}: #42464C;
    --${COLOR_DARKER}: #2C2F33;
    --${COLOR_NOTBLACK}: #23272A;
    --${COLOR_ALMOSTBLACK}: hsla(0, 0%, 10%, 1);
    --${COLOR_YETNOTBLACK}: #171717;
    --${COLOR_BLACK}: hsla(0, 0%, 5%, 1);
    --${COLOR_MENU}: #151515;
    --${COLOR_REDISH}: #EC4343;
    --${COLOR_GREENISH}: #76D976;
    --${COLOR_BLUEISH}: #7289DA;
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
   
  img {
    user-select: none;
  }
  body {
    font-family: "Exo 2";
    background-color: ${csscolor(COLOR_ALMOSTBLACK)};
    color: white;
    font-size: 1.6rem;
  }
  svg {
    fill: currentColor !important;
  }
`