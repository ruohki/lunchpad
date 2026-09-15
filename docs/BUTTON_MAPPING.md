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
the three when the reply says third generation. The buttons around the grid are `Square` in
the layout: black buttons with barely rounded corners whose printed symbol the LED lights
(`mask`), drawn against the grid's side of their cell so the ring hugs the grid.

| Region | Coordinates | MIDI | Numbers |
|---|---|---|---|
| Grid | x 0-7, y 0-7 | Note | 11..88 |
| Right column | x 8, y 0-7 | CC | 19..89 |
| Top row | x 0-7, y 8 | CC | 91..98 |
| Logo LED | (8, 8) | LED only | 99 |

LEDs: `F0 00 20 29 02 0C 03 03 <led> <r> <g> <b> … F7`, r/g/b 0..127. Press threshold:
velocity ≥ 25 (velocity sensitive pads).

## Launchpad Mini MK3  (unverified)

Same map as the X. Header `… 02 0D`. Not velocity sensitive. Its manual prints the same inquiry
family as the X's (`13 01`) while a real X answers `03 01`, so `13 01` is taken as the Mini MK3
(and `23 01` as the Pro MK3) until a device confirms it; the port name overrides the inquiry
between the three either way.

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

## Launchpad Pro MK3  (mode switch and identification verified on hardware, firmware 4.8.3, 2026-09-15)

Programmer mode in two steps: `… 02 0E 10 00` (DAW → Standalone) then `… 02 0E 0E 01`
(Live → Programmer). The mode hierarchy in the manual puts Programmer beside Live and DAW, so a
device a DAW left in Session ignores the second message on its own; leaving `10 00` out is why the
device had to be switched by hand. Back to Live on unload with `… 02 0E 0E 00`. Inquiry family `23 01`;
the device answers on all three ports with `F0 7E 00 06 02 00 20 29 23 01 00 00 00 04 08 03 F7`. Verified
with `cargo run --example promk3mode`: after `10 01` (DAW mode) the Programmer toggle alone does not take,
with `10 00` first the pads light and presses arrive in programmer numbering. The app drives the MIDI
interface (`LPProMK3 MIDI`), which also carries the clock (`F8`) the device sends. Grid is 10 wide, 11 tall; the two
bottom rows are half height. The ring of buttons on all four sides is `Square` as on the X (black,
symbol lit, hugging the grid); Shift is `Small` with the same look.

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

Not a Launchpad: 16 pads, 8 knobs, two touch strips, a few buttons and 25 keys. Driven in
DAW mode on the DAW interface (`9F 0C 7F` on, `9F 0C 00` off, then `BF 03 02` Session pads and
`BF 09 03` Pan knobs). The keys play on the MIDI interface, which the app opens as a second
input next to the DAW pair: on macOS and Linux the other Launchkey port whose name says MIDI,
on Windows the port without the `MIDIIN2` ordinal. Novation has no Mini-specific programmer's
guide; the DAW protocol of the full-size Launchkey MK3 reference applies. Identified by port
name ("Launchkey Mini MK3"); the inquiry reply's family bytes are unknown until a device is seen.

Logical layout 15 x 7 (x from the left, y from the bottom). Each pad row is two half-rows
(y 5 + 4 and y 3 + 2) so the side buttons sit where they are printed; the pads and the scene
buttons span both halves and are addressed by the upper one, so a fader cannot run down across
the two pad rows. Column 3 is the empty gap left of the pads; the empty top-right cell holds the
settings pad.

| Region | Coordinates | MIDI | Numbers | LED |
|---|---|---|---|---|
| Pitch strip | (0, 6), 5 rows | Pitch Bend, MIDI interface, any channel | 14 bit → control event, centre when released | none |
| Modulation strip | (1, 6), 5 rows | CC, MIDI interface, any channel | 1, value 0-127 → control event | none |
| Shift | (2, 6) | CC ch 16 | 108 | none |
| Transpose, Octave +, Octave − | (2, 5), (2, 4) 2 rows, (2, 2) | none in DAW mode | | none |
| Knobs 1-8 | x 4-11, y 6 | CC ch 16 | 21..28, value 0-127 → control events | none |
| Pads top row | x 4-11, y 5, 2 rows | Note ch 1 | 96..103 | RGB palette |
| Pads bottom row | x 4-11, y 3, 2 rows | Note ch 1 | 112..119 | RGB palette |
| > (scene launch) | (12, 5), 2 rows | CC ch 1 | 104 | RGB palette |
| Stop Solo Mute | (12, 3), 2 rows | CC ch 1 | 105 | RGB palette |
| Arp, Fixed Chord | (13, 4), (14, 4) | none in DAW mode | | none |
| Play, Record | (13, 2), (14, 2) | CC ch 16 | 115, 117 | white, brightness on ch 16 |
| White keys | x 0-14, y 0 | Note, MIDI interface, any channel | the white notes of 48..72 (C2..C4) | none |
| Black keys | y 1, at the x of the white key to their left | Note, MIDI interface, any channel | the black notes of 49..70 | none |

LEDs: a palette index as the velocity / value on channel 1 (solid), 2 (flashing, alternate colour)
or 3 (pulsing); RGB colours become the nearest palette entry. Knobs and strips feed a single-cell
fader placed on them; the level follows every 60 ms while one moves. A knob's fader runs its
on-change list once the movement has rested for 150 ms, with the value it stopped on. A strip's
fader has touch, move and release lists (`ControlKind::Strip` / `SprungStrip` on the control
event): the first value after a rest is the touch, every value a move, and the release is either
the sprung strip's own spring-back report (`released`, the actions get the value it was let go
at, the level follows it to the centre) or, for the modulation strip, a 150 ms rest.
Keys are mapped at the default octave: after an Octave shift they send other notes, which are
ignored because the DAW interface does not report the shift. With the Arp on, a held key repeats.

## Launchkey Mini MK4  (input verified on hardware, firmware 1.1.9.92, 2026-09-14; LEDs pending)

The MK4 revision of the Mini, driven like the MK3 (DAW mode on the DAW interface, keys and
strips on the MIDI interface as a second input) from Novation's "Launchkey MK4 Programmer's
Reference Guide" (`docs/novation/launchkey_mk4_programmers_reference_guide_v2.md`). Identified
by the inquiry reply `F0 7E 00 06 02 00 20 29 41 01 00 00 <v1 v2 v3 v4> F7` (family `41 01`;
the DAW interface answers with member `00 01`) or by port name ("Launchkey Mini MK4 25 DAW"
and "… MIDI"). On connect: `9F 0C 7F` (DAW mode), `B6 1D 02` (pads in the DAW layout),
`B6 1E 02` (encoders in Plugin mode), and `9F 0B 7F` so every feature control reports. The device
keeps acting on its own buttons, so the driver answers its reports on channel 7: a pad layout
other than DAW (CC 29, also after the Shift menu or Arp) gets `B6 1D 02`, an encoder mode other
than Plugin (CC 30) gets `B6 1E 02`, Arp or Scale switched on (CC 73 / 74) gets the matching
off. Logical layout 15 x 8 (x from the left, y from the
bottom), one column per white key, following the front panel. The control area is three bands
of two half-rows each: the encoder band (y 7 + 6) with the screen, Arp over Scale, the encoders
and the mode arrows; the two pad bands (y 5 + 4 and y 3 + 2) with the pads, the Track arrows,
> and Func, and the button block, whose ▶ and ● sit between the pad rows and Oct −/+ under
them. The settings pad sits on the screen; the logo's corner (14, 7) stays empty. Buttons whose
CCs are not confirmed on hardware are drawn but send nothing.

| Region | Coordinates | MIDI | Numbers | LED |
|---|---|---|---|---|
| Pitch strip (sprung, drawn as a bar) | (0, 7), 6 rows | Pitch Bend, MIDI interface | 14 bit → control event, centre when released | none |
| Modulation strip | (1, 7), 6 rows | CC, MIDI interface | 1, value 0-127 → control event | none |
| Screen | (2, 7), 2 rows × 2 columns | none: the app's settings pad sits there | shows the Lunchpad logo while connected: bitmap SysEx `… 02 13 09 20 <1216 bytes> F7` (128 × 64, 19 bytes per row, 7 pixels each; the device answers `… 02 13 09 F7`), handed back with `… 02 13 04 20 00 F7` on unload | |
| Shift | (2, 5) | CC ch 7 | 63 (a feature-control report) | none |
| Settings | (3, 5) | not wired (the guide lists CC 63 on ch 1) | | none |
| ▶, ● | (2, 4), (3, 4), 2 rows | CC ch 1 | 115, 117 | single LED under the symbol (`mask`), brightness as CC on ch 4 (unverified) |
| Oct −, Oct + | (2, 2), (3, 2) | none in DAW mode | | none |
| Arp, Scale | (4, 7), (4, 6) | feature report ch 7 | 73, 74: "on" is the press; the app switches the function off again and, as the device confirms nothing, adds the release itself, so each press is a tap (`momentary` in the layout: the editor offers the pressed list only) | none |
| ∧, ∨ (Track up / down) | (4, 5), (4, 3), 2 rows | CC ch 1 | 106, 107 | RGB palette on the CC (unverified) |
| Encoders 1-8 | x 5-12, y 7, 2 rows | CC ch 16 | 21..28, absolute 0-127 → control events | none |
| Pads top row | x 5-12, y 5, 2 rows | Note ch 1 + polyphonic aftertouch | 96..103 | RGB palette |
| Pads bottom row | x 5-12, y 3, 2 rows | Note ch 1 + polyphonic aftertouch | 112..119 | RGB palette |
| ∧, ∨ (mode arrows) | (13, 7), (13, 6) | CC ch 1 | 51, 52 (Mode up / down) | none |
| >, Func | (13, 5), (13, 3), 2 rows | not wired (the guide lists prev / next pad mode 75 / 76) | | none |
| White keys | x 0-14, y 0 | Note, MIDI interface | the white notes of 48..72 (C2..C4) | none |
| Black keys | y 1, at the x of the white key to their left | Note, MIDI interface | the black notes of 49..70 | none |

Differences from the Mini MK3 driver: the transport and arrow buttons report on channel 1
(not 16) and the arrows are Track up / down (106 / 107, not the scene buttons 104 / 105);
Shift is CC 63 on channel 7; the pads send aftertouch, which feeds `{{pressure}}`. The
guide's DAW table names CC 115 "Loop" and 117 "Play", but the Mini's two transport buttons
send exactly these two. Settings, Oct −/+, > and Func sent nothing in two captures. The MIDI
interface streams clock (`F8`).

## Hardware checklist (run per model)

1. `cargo run --example midiprobe -- 20` from `src-tauri`: confirm the inquiry reply and the
   family bytes, then press the bottom-left pad, the top-left round button and the
   top-right round button and compare the numbers with the table above.
2. Start the app, connect: the LED sweep must cross the whole device and end with all LEDs off.
3. Press pads: the on-screen pad lights while held and the side panel shows the coordinate.
4. Click pads in the UI: the physical pad lights orange while the mouse button is down.
5. Unplug: the status turns to "No Launchpad connected" within two seconds. Re-plug: it
   reconnects on its own (auto-connect on).
