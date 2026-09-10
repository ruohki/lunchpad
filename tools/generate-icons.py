#!/usr/bin/env python3
"""Regenerate src/icons/icons.ts from legacy/libs/icons/src/SVG/*.svg plus the
hand-drawn icons listed in EXTRA. Run from the project root."""
import glob, json, os, re

SRC = "legacy/libs/icons/src/SVG"
OUT = "src/icons/icons.ts"
EXTRA = {
    "Globe": ("0 0 24 24", '<path fill="currentColor" fill-rule="evenodd" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1 1.6C9.2 5 8 8.2 8 12s1.2 7 3 8.4V3.6Zm2 0v16.8c1.8-1.4 3-4.6 3-8.4s-1.2-7-3-8.4ZM7.5 4.3A8 8 0 0 0 4.1 11h2c.1-2.7.6-5 1.4-6.7ZM6.1 13h-2a8 8 0 0 0 3.4 6.7c-.8-1.7-1.3-4-1.4-6.7Zm10.4-2h2a8 8 0 0 0-3.4-6.7c.8 1.7 1.3 4 1.4 6.7Zm-1.4 8.7A8 8 0 0 0 19.9 13h-2c-.1 2.7-.6 5-1.4 6.7Z"/>'),
    "Code": ("0 0 24 24", '<path fill="currentColor" d="M8.7 7.3a1 1 0 0 0-1.4-1.4l-5 5a1 1 0 0 0 0 1.4l5 5a1 1 0 0 0 1.4-1.4L4.4 12l4.3-4.7Zm6.6-1.4a1 1 0 0 0-1.4 1.4l4.3 4.7-4.3 4.6a1 1 0 0 0 1.4 1.4l5-5a1 1 0 0 0 0-1.4l-5-5.3Z"/>'),
    "Variable": ("0 0 24 24", '<path fill="currentColor" d="M4 5a1 1 0 0 1 1-1h4a1 1 0 1 1 0 2H6v12h3a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1V5Zm16 0v14a1 1 0 0 1-1 1h-4a1 1 0 1 1 0-2h3V6h-3a1 1 0 1 1 0-2h4a1 1 0 0 1 1 1Zm-9.5 3.2a1 1 0 0 1 1.3.4L12 9.8l.2-.2a1 1 0 0 1 1.7 1.1L13.2 12l1 1.6a1 1 0 0 1-1.7 1L12 14.2l-.5.8a1 1 0 0 1-1.7-1.1l1-1.5-1-1.6a1 1 0 0 1 .4-1.4Z"/>'),
    "Branch": ("0 0 24 24", '<path fill="currentColor" fill-rule="evenodd" d="M7 3a3 3 0 0 0-1 5.8v6.4A3 3 0 1 0 8 15.2V9.9c.7.5 1.6.8 2.7.9h2.6a3 3 0 1 0 0-2h-2.6C9.5 8.8 8 7.7 8 6a3 3 0 0 0-1-3Zm0 2a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm0 12a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm9-9a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z"/>'),
    "Streamlabs": ("0 0 24 24", '<circle cx="12" cy="13" r="2.4" fill="currentColor"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M8.2 9.2a5.4 5.4 0 0 0 0 7.6M15.8 9.2a5.4 5.4 0 0 1 0 7.6M5.2 6.2a9.6 9.6 0 0 0 0 13.6M18.8 6.2a9.6 9.6 0 0 1 0 13.6"/>'),
    "Play": ("0 0 24 24", '<path fill="currentColor" d="M8 5.4v13.2c0 .8.9 1.3 1.6.9l10.4-6.6a1 1 0 0 0 0-1.8L9.6 4.5C8.9 4.1 8 4.6 8 5.4Z"/>'),
}

icons = {}
for path in sorted(glob.glob(os.path.join(SRC, "*.svg"))):
    name = os.path.splitext(os.path.basename(path))[0]
    svg = open(path).read()
    tag = re.search(r"<svg[^>]*>", svg).group(0)
    vb = re.search(r'viewBox="([^"]+)"', tag)
    w = re.search(r'width="([\d.]+)"', tag)
    h = re.search(r'height="([\d.]+)"', tag)
    view_box = vb.group(1) if vb else f"0 0 {w.group(1)} {h.group(1)}"
    body = svg[len(tag) + svg.find(tag):].rsplit("</svg>", 1)[0].strip()
    body = re.sub(r'(fill|stroke)="(white|#fff|#ffffff)"', r'\1="currentColor"', body, flags=re.I)
    icons[name] = (view_box, re.sub(r"\s+", " ", body))
icons.update(EXTRA)

lines = [
    "/**",
    " * Icon set: the legacy Lunchpad SVGs (libs/icons in the Electron app) plus a few",
    " * drawn for actions that did not exist back then. Generated from",
    " * legacy/libs/icons/src/SVG by tools/generate-icons.py; edit the SVGs, not this file.",
    " */",
    "",
    "export const ICONS = {",
]
for name in sorted(icons):
    vb, body = icons[name]
    lines.append(f"  {name}: {{ viewBox: {json.dumps(vb)}, body: {json.dumps(body)} }},")
lines += ["} as const;", "", "export type IconName = keyof typeof ICONS;", ""]
open(OUT, "w").write("\n".join(lines))
print(f"{len(icons)} icons written to {OUT}")
