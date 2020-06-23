export const XYToButton = (x, y) => y * 10 + x

export const ButtonToXY = (note: number): [ number, number ] =>{
  return [(note % 10), Math.floor(note / 10)]
} 