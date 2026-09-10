"""Draw the macOS menu bar template icon: a ring with four rounded pads inside.
Black shapes on transparency; macOS tints it for light/dark menu bars.

Run from the project root: `python3 tools/tray-icon.py` writes
src-tauri/icons/tray-template.png (22 px) and tray-template@2x.png (44 px)."""
import math, struct, zlib, sys

def png(path, size, pixels):
    raw = b"".join(b"\x00" + bytes(pixels[y]) for y in range(size))
    def chunk(t, d): return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    open(path, "wb").write(data)

def rounded_rect_inside(px, py, cx, cy, half, radius):
    dx, dy = abs(px - cx) - (half - radius), abs(py - cy) - (half - radius)
    if dx <= 0 and dy <= 0: return True
    if dx > 0 and dy > 0: return dx * dx + dy * dy <= radius * radius
    return max(dx, dy) <= radius

def render(size, scale):
    ss = 8  # supersampling per axis
    c = size / 2
    outer = size / 2 - 0.5 * scale
    ring = 1.7 * scale
    pad = 4.9 * scale          # pad edge
    gap = 1.5 * scale
    corner = 1.25 * scale
    off = (pad + gap) / 2
    centers = [(c - off, c - off), (c + off, c - off), (c - off, c + off), (c + off, c + off)]
    rows = []
    for y in range(size):
        row = []
        for x in range(size):
            hit = 0
            for sy in range(ss):
                for sx in range(ss):
                    px, py = x + (sx + 0.5) / ss, y + (sy + 0.5) / ss
                    d = math.hypot(px - c, py - c)
                    if outer - ring <= d <= outer:
                        hit += 1
                    elif any(rounded_rect_inside(px, py, cx, cy, pad / 2, corner) for cx, cy in centers):
                        hit += 1
            a = round(255 * hit / (ss * ss))
            row += [0, 0, 0, a]
        rows.append(row)
    return rows

png("src-tauri/icons/tray-template.png", 22, render(22, 1.0))
png("src-tauri/icons/tray-template@2x.png", 44, render(44, 2.0))
print("written")
