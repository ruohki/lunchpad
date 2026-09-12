# Button mapping and hardware checklists

Coordinates: `x` from the left, `y` from the bottom. `(0, 0)` is the bottom-left pad of the
8x8 grid on every model. The UI draws rows top-down, so it reverses `y` when rendering.

Every driver lives in `src-tauri/src/midi/models/<model>.rs` and exposes:

- `xy_to_note(x, y) -> Option<(number, is_cc)>`
- `note_to_xy(number, is_cc) -> Option<(x, y)>`
- `layout()` describing each control (shape, region, printed legend, note/CC)
- `init_messages()`, `unload_messages()`, `clear_messages()`, `color_messages()`

`cargo test` checks that every layout round-trips through the two mapping functions.

## Launchpad MK2  (verified on hardware, firmware 0.1.7.1)

Session layout (`F0 00 20 29 02 18 22 00 F7`). Inquiry reply family `69`.

| Region | Coordinates | MIDI | Numbers |
|---|---|---|---|
| Grid | x 0-7, y 0-7 | Note | `(y+1)*10 + x + 1` → 11..88 |
| Right column (scene) | x 8, y 0-7 | Note | 19, 29, … 89 |
| Top row | x 0-7, y 8 | CC | 104..111 |
| (8, 8) | | none | no control |

LEDs (manual v1.03, `docs/novation/`): RGB `F0 00 20 29 02 18 0B <led> <r> <g> <b> … F7`
(0..63, up to 80 LEDs); palette `… 0A <led> <colour> …`; flash `… 23 00 <led> <colour> …`
and pulse `… 28 00 <led> <colour> …` (a reserved mode byte precedes the LED; the manual's hex
line omits it but its decimal listing and summary table show it); all off `… 0E 00 F7`.
Flashing alternates between the LED's current colour and the given one, so the base colour
is sent as palette first. Verified on hardware: flash and pulse animate (2026-09-10).

Captured presses (macOS): `90 11 7F` (17 → 6,0), `B0 68 7F` (104 → 0,8), `90 4F 7F`
(79 → 8,6), `90 58 7F` (88 → 7,7).

## Launchpad X  (verified on hardware, firmware 0.2.3.8, 2026-09-10)

Programmer mode (`… 02 0C 0E 01`, layout `… 02 0C 00 7F` = Programmer). Inquiry reply
`… 00 20 29 03 01 00 00 <app version>` on real hardware (the manual prints `13 01`; both are
accepted). The X, Mini MK3 and Pro MK3 manuals all print the same reply, so the scanner lets
the port name ("LPX", "LPMiniMK3", "LPProMK3") decide between
the three when the reply says third generation.

| Region | Coordinates | MIDI | Numbers |
|---|---|---|---|
| Grid | x 0-7, y 0-7 | Note | 11..88 |
| Right column | x 8, y 0-7 | CC | 19..89 |
| Top row | x 0-7, y 8 | CC | 91..98 |
| Logo LED | (8, 8) | LED only | 99 |

LEDs: `F0 00 20 29 02 0C 03 03 <led> <r> <g> <b> … F7`, r/g/b 0..127. Press threshold:
velocity ≥ 25 (velocity sensitive pads).

## Launchpad Mini MK3  (unverified)

Same map as the X. Header `… 02 0D`. Inquiry family `13 0D`. Not velocity sensitive.

## Launchpad Pro MK2  (verified on hardware, firmware 0.1.8.2, 2026-09-10)

Standalone mode + programmer layout (`… 02 10 21 01`, `… 02 10 2C 03`). Inquiry family `51`
(manual: `… 00 20 29 51 00 00 00 <4 firmware bytes>`). Flash/pulse are `… 23 <led> <colour>`
and `… 28 <led> <colour>` **without** the MK2's mode byte (up to 97 pairs); RGB up to 78.

The device exposes three port pairs (Live, Standalone, MIDI) and answers the inquiry on the
first two; the scanner keeps the Standalone pair. Velocity comes from the Pro's own set-up
screen (hold Setup: third grid row from the top, Low / Med / High / Off, stored per layout).
With Off every press reports 127. The 10 x 10 numbering below is deliberately the device's
own, so a page built on an 8 x 8 model lands one pad up and right on a Pro.

| Region | Coordinates | MIDI | Numbers |
|---|---|---|---|
| Grid | x 1-8, y 1-8 | Note | `y*10 + x` → 11..88 |
| Left column | x 0, y 1-8 | CC | 10, 20, … 80 |
| Right column | x 9, y 1-8 | CC | 19, 29, … 89 |
| Bottom row | x 1-8, y 0 | CC | 1..8 |
| Top row | x 1-8, y 9 | CC | 91..98 |
| Corners | (0,0) (9,0) (0,9) (9,9) | none | |

LEDs: `F0 00 20 29 02 10 0B <led> <r> <g> <b> … F7`, r/g/b 0..63, 78 LEDs per message.

## Launchpad Pro MK3  (unverified)

Programmer mode (`… 02 0E 0E 01`). Inquiry family `23 01`. Grid is 10 wide, 11 tall; the two
bottom rows are half height.

| Region | Coordinates | MIDI | Numbers |
|---|---|---|---|
| Bottom function row | x 1-8, y 0 | CC | 1..8 |
| Track select row | x 1-8, y 1 | CC | 101..108 |
| Grid | x 1-8, y 2-9 | Note | `(y-1)*10 + x` → 11..88 |
| Left column | x 0, y 2-9 | CC | 10..80 |
| Right column | x 9, y 2-9 | CC | 19..89 |
| Shift (small) | (0, 10) | CC | 90 |
| Top row | x 1-8, y 10 | CC | 91..98 |
| Logo LED | (9, 10) | LED only | 99 |

LEDs as on the X (`… 02 0E 03 …`, 0..127).

## Launchpad S / MK1 / Mini MK1-2  (Launchpad S and Launchpad Mini verified on hardware 2026-09-10; original MK1 pending)

No SysEx. Reset `B0 00 00`. X-Y layout. The S gave no reply to the device inquiry within the
scan window and is identified by its port name ("Launchpad S"); the Mini (firmware 0.0.3.2)
answers the inquiry and shows up as "Launchpad Mini".

| Region | Coordinates | MIDI | Numbers |
|---|---|---|---|
| Grid | x 0-7, y 0-7 | Note | `(7-y)*16 + x` |
| Right column | x 8, y 0-7 | Note | `(7-y)*16 + 8` |
| Top row | x 0-7, y 8 | CC | 104..111 |

Colours are velocities: `0x10 * green + red + 0x0C` with red/green in 0..3. Top row uses
`B0`, everything else `90`. Blue is dropped, so a pure blue pad is dark; the UI draws pads
through the same reduction (`limitedRgb` in `src/lib/colors.ts`) when `limitedColor` is set.

Flashing rides on the hardware double buffer: after the reset the driver sends `B0 00 28`
(flash on, write buffer 0). Steady pads use flags `0x0C` (both buffers); a flashing pad is
written with flags `0x00` as colour A, then `B0 00 2C` selects buffer 1, colour B is written,
and `B0 00 28` returns to buffer 0. Pulsing has no hardware equivalent and shows steady.

## Launchkey Mini MK3  (unverified)

Not a Launchpad: 16 pads, 8 knobs, two touch strips, a few buttons and a keyboard. Driven in
DAW mode on the DAW port (`9F 0C 7F` on, `9F 0C 00` off, then `BF 03 02` Session pads and
`BF 09 03` Pan knobs). Novation has no Mini-specific programmer's guide; the DAW protocol of
the full-size Launchkey MK3 reference applies. Identified by port name ("Launchkey Mini MK3");
the inquiry reply's family bytes are unknown until a device is seen.

Logical layout 14 x 4 (x from the left, y from the bottom):

| Region | Coordinates | MIDI | Numbers | LED |
|---|---|---|---|---|
| Pitch / Mod strips | (0, 3), (1, 3), 4 rows | not read yet | | none |
| Shift | (2, 3) | CC ch 16 | 108 | none |
| Transpose, Octave ± | (2, 2), (2, 1), (2, 0) | none in DAW mode | | none |
| Knobs 1-8 | x 3-10, y 3 | CC ch 16 | 21..28, value 0-127 → control events | none |
| Pads top row | x 3-10, y 2 | Note ch 1 | 96..103 | RGB palette |
| Pads bottom row | x 3-10, y 1 | Note ch 1 | 112..119 | RGB palette |
| ▶ (scene launch) | (11, 2) | CC ch 1 | 104 | RGB palette |
| Stop Solo Mute | (11, 1) | CC ch 1 | 105 | RGB palette |
| Arp, Fixed Chord | (12, 2), (13, 2) | none in DAW mode | | none |
| Play, Record | (12, 1), (13, 1) | CC ch 16 | 115, 117 | white, brightness on ch 16 |

LEDs: a palette index as the velocity / value on channel 1 (solid), 2 (flashing, alternate colour)
or 3 (pulsing); RGB colours become the nearest palette entry. Knobs feed a single-cell fader
placed on them; the engine paces the fader's actions to one run per 60 ms while a knob moves.

## Hardware checklist (run per model)

1. `cargo run --example midiprobe -- 20` from `src-tauri`: confirm the inquiry reply and the
   family bytes, then press the bottom-left pad, the top-left round button and the
   top-right round button and compare the numbers with the table above.
2. Start the app, connect: the LED sweep must cross the whole device and end with all LEDs off.
3. Press pads: the on-screen pad lights while held and the side panel shows the coordinate.
4. Click pads in the UI: the physical pad lights orange while the mouse button is down.
5. Unplug: the status turns to "No Launchpad connected" within two seconds. Re-plug: it
   reconnects on its own (auto-connect on).
