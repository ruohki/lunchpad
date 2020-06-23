import { lighten } from 'polished';
import { LaunchpadButtonColor, LaunchpadSolidButtonColor, LaunchpadButtonColorMode, LaunchpadFlashingButtonColor, LaunchpadPulsingButtonColor, LaunchpadRGBButtonColor } from '@lunchpad/types';

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
    const { r, g, b } = LaunchpadSolidButtonColor.getRGB(color as LaunchpadSolidButtonColor)
    return luminanceColor(r,g,b);
  } else if (color.mode === LaunchpadButtonColorMode.Flashing) {
    const { r, g, b } = LaunchpadFlashingButtonColor.getRGB(color as LaunchpadFlashingButtonColor)
    return luminanceColor(r,g,b);
  } else if (color.mode === LaunchpadButtonColorMode.Pulsing) {
    const { r, g, b } = LaunchpadPulsingButtonColor.getRGB(color as LaunchpadPulsingButtonColor)
    return luminanceColor(r,g,b);
  } else if (color.mode === LaunchpadButtonColorMode.RGB) {
    const { r, g, b } = LaunchpadRGBButtonColor.getRGB(color as LaunchpadRGBButtonColor)
    return luminanceColor(r,g,b);
  }
}