export const XYToButton = (x, y) => {
  if (y < 8 ) {
    return (y + 1) * 10 + x + 1
  } else return 104 + x
}

export const ButtonToXY = (note): [ number, number] => note < 104 ? [(note % 10) - 1, Math.floor(note / 10) - 1] : [note - 104, 8 ]
