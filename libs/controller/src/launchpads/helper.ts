// 0x68 - 0x70   104 - 112
//00               08
//10               18
//20               28
//30               38
//40               48
//50               58
//60               68
//70               78
//112
export const XYToButton = (x: number, y: number): number => {
  if (y === 8) return 104 + x
  return (0x70 - (y * 0x10)) + x
}

export const ButtonToXY = (note: number, cc: boolean): [ number, number ] => {
  if (cc) return [ note - 104, 8 ] 
  return [(note % 16), 7 - Math.floor((note / 16)) ]
}