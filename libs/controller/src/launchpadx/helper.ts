export const XYToButton = (x, y) => {
  return (y + 1) * 10 + x + 1
}

export const ButtonToXY = (note: number): [number, number] => [(note % 10) - 1, Math.floor(note / 10) - 1] 