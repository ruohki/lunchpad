import { lighten } from 'polished';
import { LaunchpadButtonColorMode, LaunchpadButtonColor, LaunchpadFlashingButtonColor, LaunchpadPulsingButtonColor, LaunchpadRGBButtonColor } from '../contexts/layout/classes';

const luminanceColor = (r: number, g: number, b: number): string => {
  let result = "#1f1f1f"
  const luminance = (((0.2126*(r)) + (0.7152*(g)) + (0.0722* (b))) / 255) || 0.1
  result = `rgb(${r},${g}, ${b})`
  if (luminance <= 0.1) {
    result = lighten((1 / Math.sinh(luminance)) / 50, `rgb(${r},${g}, ${b})`)
  }
  return result;
}

export const MakeButtonColor = (color: LaunchpadButtonColor) => {
  if (color.mode === LaunchpadButtonColorMode.Static) {
    const { r, g, b } = color.getRGB()
    return luminanceColor(r,g,b);
  } else if (color.mode === LaunchpadButtonColorMode.Flashing) {
    const { r, g, b } = color.getRGB()
    return luminanceColor(r,g,b);
  } else if (color.mode === LaunchpadButtonColorMode.Pulsing) {
    const { r, g, b } = color.getRGB()
    return luminanceColor(r,g,b);
  } else if (color.mode === LaunchpadButtonColorMode.RGB) {
    const { r, g, b } = color.getRGB()
    return luminanceColor(r,g,b);
  }
}