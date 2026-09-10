import type { Layout, Page, PlacedButton } from "./api";

/** Buttons of a page that the connected layout has no pad for (kept, invisible until a bigger Launchpad is used). */
export function buttonsOutside(page: Page, layout: Layout | null): PlacedButton[] {
  if (!layout) return [];
  return page.buttons.filter((b) => {
    const spec = layout.pads.find((p) => p.x === b.x && p.y === b.y);
    return !spec || spec.shape === "empty" || spec.shape === "logo";
  });
}
