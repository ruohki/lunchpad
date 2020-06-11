const SpecialKeys = [
  'backspace',
  'delete',
  'enter',
  'tab',
  'escape',
  'up',
  'down',
  'right',
  'left',
  'home',
  'end',
  'pageup',
  'pagedown',
  'f1',
  'f2',
  'f3',
  'f4',
  'f5',
  'f6',
  'f7',
  'f8',
  'f9',
  'f10',
  'f11',
  'f12',
  'command',
  'alt',
  'right_alt',
  'control',
  'left_control',
  'right_control',
  'shift',
  'right_shift',
  'space',
  'printscreen',
  'insert',
  'menu',
  'capslock',
  'audio_mute',
  'audio_vol_down',
  'audio_vol_up',
  'audio_play',
  'audio_stop',
  'audio_pause',
  'audio_prev',
  'audio_next',
  'audio_rewind',
  'audio_forward',
  'audio_repeat',
  'audio_random',
  'numpad_0',
  'numpad_1',
  'numpad_2',
  'numpad_3',
  'numpad_4',
  'numpad_5',
  'numpad_6',
  'numpad_7',
  'numpad_8',
  'numpad_9',
  'numpad_lock',
  'numpad_+',
  'numpad_-',
	'numpad_*',
	'numpad_/',
	'numpad_.'
];

const Numbers = [
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9"
]

const Keys = [
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "g",
  "h",
  "i",
  "j",
  "k",
  "l",
  "m",
  "n",
  "o",
  "p",
  "q",
  "r",
  "s",
  "t",
  "u",
  "v",
  "w",
  "x",
  "y",
  "z",
  "ä",
  "ö",
  "ü",
  "ß",
]

const Special = [
  "!",
  '"',
  "§",
  "$",
  "%",
  "&",
  "/",
  "\\",
  "(",
  ")",
  "=",
  "?",
  "´",
  "`",
  "*",
  "+",
  "'",
  "#",
  "-",
  "_",
  ".",
  ":",
  ";",
  ",",
  ">",
  "<",
  "@",
  "°",
  "^",
  "~"
]

export const KeyboardKeys = [...Keys, ...Numbers, ...Special, ...SpecialKeys];