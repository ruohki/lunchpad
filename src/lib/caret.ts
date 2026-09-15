/**
 * Viewport rectangle of the character at `index` inside `root`, counted over
 * its text nodes in document order. Callers hand in a copy of a field's text
 * that is laid out exactly like the field (same font, padding and wrapping),
 * so the rectangle is where the field draws that character.
 */
export function charRect(root: HTMLElement | null, index: number): DOMRect | null {
  if (!root || index < 0) return null;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode() as Text | null;
  let at = index;
  while (node && at >= node.length) {
    at -= node.length;
    node = walker.nextNode() as Text | null;
  }
  if (!node) return null;
  const range = document.createRange();
  range.setStart(node, at);
  range.setEnd(node, at + 1);
  const rect = range.getClientRects()[0] ?? range.getBoundingClientRect();
  return rect.height > 0 ? rect : null;
}

/**
 * Where a completion list belongs for text typed from `from` up to `caret`:
 * a zero-width rectangle on the caret's line, aligned with the start of the
 * typed text unless that wrapped onto an earlier line.
 */
export function typedRect(root: HTMLElement | null, from: number, caret: number): DOMRect | null {
  if (caret <= 0) return null;
  const end = charRect(root, caret - 1);
  if (!end) return null;
  const start = charRect(root, from);
  const left = start && Math.abs(start.top - end.top) < 1 ? start.left : end.right;
  return new DOMRect(left, end.top, 0, end.height);
}
