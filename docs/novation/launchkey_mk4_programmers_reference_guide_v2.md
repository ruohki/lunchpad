# Launchkey MK4 Programmer's Reference Guide

**Version 2.0**

> Converted from the official Focusrite PDF. Figure-based MIDI mappings have been transcribed into accessible tables.

Table of Contents About this Guide ...................................................................................................................... 3 Bootloader ............................................................................................................................. 4 MIDI on Launchkey MK4 ............................................................................................................ 5 SysEx message format used by the device ............................................................................ 5 Standalone (MIDI) mode ........................................................................................................... 6 DAW mode .............................................................................................................................. 8 DAW mode control ........................................................................................................... 8 The surface in DAW mode .................................................................................................. 8 Additional modes available in DAW mode ........................................................................... 10 Mode report and select .................................................................................................... 10 DAW mode ..................................................................................................................... 11 Drum mode ................................................................................................................... 12 Encoder modes .............................................................................................................. 12 Fader mode (Launchkey 49/61 only) .................................................................................. 13 Colouring the surface ...................................................................................................... 14 Controlling the screen ..................................................................................................... 17 Launchkey MK4 feature controls ............................................................................................... 21
# About this Guide
This document provides all the information you need to be able to control the Launchkey MK4.

The Launchkey communicates using MIDI over USB and DIN. This document describes the MIDI implementation for the device, the MIDI events coming from it, and how the Launchkey’s various features can be accessed through MIDI messages.

MIDI data is expressed in this manual in several ways:
- A plain English description of the message.
- When we describe a musical note, middle C is deemed to be ‘C3’ or note 60. MIDI channel 1 is the lowest-numbered MIDI channel: channels range from 1 to 16.
- MIDI messages are also expressed in plain data, with decimal and hexadecimal equivalents. The hexadecimal number will always be followed by an ‘h’ and the decimal equivalent given in brackets. For example, a note on message on channel 1 is signified by the status byte 90h (144).
# Bootloader
The Launchkey has a bootloader mode that allows the user to view the current FW versions, and enable/ disable Easy Start. The bootloader is accessed by holding the Octave Up and Octave Down buttons together whilst powering up the device.

The screen will display the current Application and Bootloader version numbers.

The Record button can be used to toggle Easy Start. When Easy Start is ON, the Launchkey shows up as a Mass Storage Device to provide a more convenient first-time experience. You can turn this off once you are familiar with the device to disable this Mass Storage Device.

The Play button can be used to start the Application.
# MIDI on Launchkey MK4
The Launchkey has two MIDI interfaces, providing two pairs of MIDI inputs and outputs over USB. They are as follows:
- MIDI In / Out (or first interface on Windows): This interface is used to receive MIDI from performing (keys, wheels, pad, pot, and fader Custom Modes); and is used to provide external MIDI input.
- DAW In / Out (or second interface on Windows): This interface is used by DAWs and similar software to interact with the Launchkey.

The Launchkey also has a MIDI DIN output port, which transmits the same data a as is received on host port MIDI In (USB). Note that this excludes responses to requests issued by the host to the Launchkey on MIDI Out (USB).

If you wish to use Launchkey as a control surface for a DAW (Digital Audio Workstation), you will likely want to use the DAW interface (See DAW Mode ).

Otherwise, you may interact with the device using the MIDI interface.

The Launchkey sends Note On (90h (144) - 9Fh (159)) with velocity zero for Note Offs. It accepts either Note Offs (80h (128) - 8Fh (143)) or Note Ons (90h (144) - 9Fh (159)) with velocity zero for Note Off.

## SysEx message format used by the device

All SysEx messages begin with the following header, regardless of direction (Host -> Launchkey or Launchkey -> Host):

Regular SKUs:

 Hex: F0h 00h 20h 29h 02h 14h Dec: 240 0 32 41 2 20

Mini SKUs:

 Hex: F0h 00h 20h 29h 02h 13h Dec: 240 0 32 41 2 19

After the header is a command byte, selecting the function to use, and then whatever data is required for that function.
# Standalone (MIDI) mode
The Launchkey powers up into Standalone mode. This mode does not provide specific functionality for interaction with DAWs, the DAW in/out (USB) interface remains unused for this purpose. However, to provide means for capturing events on the Launchkey’s DAW control buttons, they do send MIDI Control Change events on Channel 16 (MIDI status: BFh, 191) on the MIDI in / out (USB) interface and the MIDI DIN port:

| Control | Decimal CC |
|---|---:|
| Track Left | 103 |
| Track Right | 102 |
| Encoder mode previous | 74 |
| Encoder mode next | 77 |
| Pad mode previous | 75 |
| Pad mode next | 76 |
| Loop | 115 |
| Stop | 116 |
| Play | 117 |
| Record | 118 |

Launchkey Mini: Start sends MIDI Real Time Start; Shift + Start sends MIDI Real Time Stop.

| Control | Hex CC |
|---|---:|
| Track Left | 67h |
| Track Right | 66h |
| Encoder mode previous | 4Ah |
| Encoder mode next | 4Dh |
| Pad mode previous | 4Bh |
| Pad mode next | 4Ch |
| Loop | 73h |
| Stop | 74h |
| Play | 75h |
| Record | 76h |

The Start and Stop buttons (Start and Shift + Start on Launchkey Mini SKUs) output the MIDI Real Time Start and Stop messages respectively

When creating Custom Modes for the Launchkey, keep these in mind if you are setting up controls to operate on MIDI Channel 16.
# DAW mode
DAW mode provides DAWs and DAW-like software functionality to realise intuitive user interfaces on the Launchkey’s surface. The capabilities described in this chapter are only available once DAW mode is enabled.

All functionality described in this chapter is accessible through the DAW In/Out (USB) interface.

## DAW mode control

Enable DAW Mode:

 Hex: 9fh 0Ch 7Fh Dec: 159 12 127

Disable DAW Mode:

 Hex: 9Fh 0Ch 00h Dec: 159 12 0

When the DAW or DAW-like software recognises the Launchkey and connects to it, it should first enter DAW mode (send 9Fh 0Ch 7Fh), and then, if necessary, enable the feature controls (see the “Launchkey MK4 feature controls” section of this document).

When the DAW or DAW-like software exits, it should exit from DAW mode on the Launchkey (send 9Fh 0Ch 00h) to return it to Standalone (MIDI) mode.

## The surface in DAW mode

In DAW mode, contrary to standalone (MIDI) mode, all buttons, and surface elements not belonging to performance features (such as the Custom Modes) can be accessed and will report on the DAW In/Out (USB) interface only. The buttons except for those belonging to the Faders are mapped to Control Change events as follows:

| Control | Decimal CC | Hex CC |
|---|---:|---:|
| Settings | 63 | 3Fh |
| Track Left | 103 | 67h |
| Track Right | 102 | 66h |
| Mode Up | 51 | 33h |
| Mode Down | 52 | 34h |
| Previous encoder mode | 74 | 4Ah |
| Next encoder mode | 77 | 4Dh |
| Previous pad mode | 75 | 4Bh |
| Next pad mode | 76 | 4Ch |
| Track Up | 106 | 6Ah |
| Track Down | 107 | 6Bh |
| Scene Up | 104 | 68h |
| Scene Down | 105 | 69h |
| Loop | 115 | 73h |
| Stop | 116 | 74h |
| Play | 117 | 75h |
| Record | 118 | 76h |

On Launchkey Mini, the two additional mode-arrow controls use decimal CC 55/56 (37h/38h).

The Control Change indices listed are also used for sending colour to the corresponding LEDs (if the button has any), see Colouring the surface .

## Additional modes available in DAW mode

Once in DAW mode, the following additional modes become available:
- DAW mode on the pads.
- Plugin, Mixers, Sends & Transport on the encoders.
- Volume on the faders (Launchkey 49/61 only).

When entering DAW mode, the surface is set up in the following manner:
- Pads: DAW.
- Encoders: Plugin.
- Faders: Volume (Launchkey 49/61 only).

The DAW should initialise each of these areas accordingly.

## Mode report and select

The modes of the pads, encoders, and faders can be controlled by MIDI events and are reported back by the Launchkey whenever it changes mode due to user activity. These messages are important to capture, as the DAW should follow them when setting up and using the surfaces as intended based on the selected mode.

## Pad modes

Pad mode changes are reported or can be changed by the following MIDI event:
- Channel 7 (MIDI status: B6h, 182), Control Change 1Dh (29)

The Pad modes are mapped to the following values:
- 01h (1): Drum layout
- 02h (2): DAW layout
- 04h (4): User Chords
- 05h (5): Custom Mode 1
- 06h (6): Custom Mode 2
- 07h (7): Custom Mode 3
- 08h (8): Custom Mode 4
- 0Dh (13): Arp Pattern
- 0Eh (14): Chord Map

## Encoder modes

Encoder mode changes are reported or can be changed by the following MIDI event:
- Channel 7 (MIDI status: B6h, 182), Control Change 1Eh (30)

The encoder modes are mapped to the following values:
- 01h (1): Mixer
- 02h (2): Plugin
- 04h (4): Sends
- 05h (5): Transport
- 06h (6): Custom Mode 1
- 07h (7): Custom Mode 2
- 08h (8): Custom Mode 3
- 09h (9): Custom Mode 4

## Fader modes (Launchkey 49/61 only)

Fader mode changes are reported or can be changed by the following MIDI event:
- Channel 7 (MIDI status: B6h, 182), Control Change 1Fh (31)

The fader modes are mapped to the following values:
- 01h (1): Volume
- 06h (6): Custom Mode 1
- 07h (7): Custom Mode 2
- 08h (8): Custom Mode 3
- 09h (9): Custom Mode 4

## DAW mode

The DAW mode on pads is selected on entering DAW mode, and when the user selects it by the Shift menu. The pads report back as note (MIDI status: 90h, 144) and aftertouch (MIDI status: A0h, 160) events (the latter only if Polyphonic Aftertouch is selected) on Channel 1, and can be accessed for colouring their LEDs by the following indices:

| Pad row | Hex note indices | Decimal note indices |
|---|---|---|
| Top | 60h, 61h, 62h, 63h, 64h, 65h, 66h, 67h | 96, 97, 98, 99, 100, 101, 102, 103 |
| Bottom | 70h, 71h, 72h, 73h, 74h, 75h, 76h, 77h | 112, 113, 114, 115, 116, 117, 118, 119 |

## Drum mode

The Drum mode on pads can replace the Drum mode of standalone (MIDI) mode, providing a capability to the DAW to control its colours and receive the messages on the DAW MIDI port. This is done by sending the below message:

 Hex: B6h 54h 01h Dec: 182 84 1

Drum mode can be returned to standalone operation with the below message:

 Hex: B6h 54h 00h Dec: 182 84 0

The pads report back as note (MIDI status: 9Ah, 154) and Aftertouch (MIDI status: AAh, 170) events (the latter only if Polyphonic Aftertouch is selected) on Channel 10, and can be accessed for colouring their LEDs (see “Colouring the Surface ”) by the following indices:

| Pad row | Hex note indices | Decimal note indices |
|---|---|---|
| Top | 28h, 29h, 2Ah, 2Bh, 30h, 31h, 32h, 33h | 40, 41, 42, 43, 48, 49, 50, 51 |
| Bottom | 24h, 25h, 26h, 27h, 2Ch, 2Dh, 2Eh, 2Fh | 36, 37, 38, 39, 44, 45, 46, 47 |

## Encoder modes
## Absolute Mode

The Encoders in the following modes provide the same set of Control Changes on Channel 16 (MIDI status: BFh, 191):
- Plugin
- Mixer
- Sends

The Control Change indices are:

| Encoder | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Hex CC | 15h | 16h | 17h | 18h | 19h | 1Ah | 1Bh | 1Ch |
| Decimal CC | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 |

If the DAW sends them position information, they automatically pick that up.

## Relative Mode

The Transport Mode uses the relative output mode with the following Control Changes on Channel 16 (MIDI status: BFh, 191):

| Encoder | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Hex CC | 55h | 56h | 57h | 58h | 59h | 5Ah | 5Bh | 5Ch |
| Decimal CC | 85 | 86 | 87 | 88 | 89 | 90 | 91 | 92 |

In Relative mode, the pivot value is 40h(64) (no movement). Values above the pivot point encode clockwise movements. Values below the pivot point encode anticlockwise movements. For example, 41h(65) corresponds to 1 step clockwise and 3Fh(63) corresponds to 1 step anticlockwise.

If Continuous Control Touch events are enabled, the Touch On is sent as a Control Change event with Value 127 on Channel 15, while the Touch Off is sent as a Control Change event with Value 0 on Channel 15. For example, the leftmost Pot would send BEh 55h 7Fh for Touch On, and BEh 55h 00h for Touch Off.

## Fader mode (Launchkey 49/61 only)

The Faders, in Volume mode, provide the following set of Control Changes on Channel 16 (MIDI status: BFh, 191):

| Fader | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | Master |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Fader hex CC | 05h | 06h | 07h | 08h | 09h | 0Ah | 0Bh | 0Ch | 0Dh |
| Fader decimal CC | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 |
| Button hex CC | 25h | 26h | 27h | 28h | 29h | 2Ah | 2Bh | 2Ch | 2Dh |
| Button decimal CC | 37 | 38 | 39 | 40 | 41 | 42 | 43 | 44 | 45 |

If Continuous Control Touch events are enabled, the Touch On is sent as a Control Change event with Value 127 on Channel 15, while the Touch Off is sent as a Control Change event with Value 0 on Channel 15. For example, the leftmost Fader would send BEh 05h 7Fh for Touch On, and BEh 05h 00h for Touch Off.

## Colouring the surface

For all controls except the Drum mode, a note, or a control change matching those described in the reports can be sent to colour the corresponding LED (if the control has any) on the following channels:
- Channel 1: Set stationary colour.
- Channel 2: Set flashing colour.
- Channel 3: Set pulsing colour.

For the Drum mode on Pads, Once the DAW has taken control of the mode , the following channels apply:
- Channel 10: Set stationary colour.
- Channel 11: Set flashing colour.
- Channel 12: Set pulsing colour.

The colour is selected from the colour palette by the note event’s Velocity or the control change’s value.

Monochrome LEDs can have their brightness set using a CC on channel 4, the CC number is the LED index, the value is the brightness.

e.g.

 Hex: 93h 73h 7Fh Dec: 147 115 127

## Colour palette

When providing colours by MIDI notes or control changes, use the following palette (decimal index above hexadecimal index):

<table>
<tr><td style="background:#333333;color:#fff;text-align:center;padding:4px">0<br><code>00h</code></td><td style="background:#5b5b5b;color:#fff;text-align:center;padding:4px">1<br><code>01h</code></td><td style="background:#888888;color:#000;text-align:center;padding:4px">2<br><code>02h</code></td><td style="background:#ffffff;color:#000;text-align:center;padding:4px">3<br><code>03h</code></td><td style="background:#ff9b9b;color:#000;text-align:center;padding:4px">4<br><code>04h</code></td><td style="background:#ff4d5a;color:#000;text-align:center;padding:4px">5<br><code>05h</code></td><td style="background:#d63f49;color:#fff;text-align:center;padding:4px">6<br><code>06h</code></td><td style="background:#98454b;color:#fff;text-align:center;padding:4px">7<br><code>07h</code></td><td style="background:#f7e7bd;color:#000;text-align:center;padding:4px">8<br><code>08h</code></td><td style="background:#ffbd45;color:#000;text-align:center;padding:4px">9<br><code>09h</code></td><td style="background:#d5845d;color:#000;text-align:center;padding:4px">10<br><code>0Ah</code></td><td style="background:#b58b85;color:#000;text-align:center;padding:4px">11<br><code>0Bh</code></td><td style="background:#fff486;color:#000;text-align:center;padding:4px">12<br><code>0Ch</code></td><td style="background:#f0f65a;color:#000;text-align:center;padding:4px">13<br><code>0Dh</code></td><td style="background:#d6e85d;color:#000;text-align:center;padding:4px">14<br><code>0Eh</code></td><td style="background:#acbb67;color:#000;text-align:center;padding:4px">15<br><code>0Fh</code></td></tr>
<tr><td style="background:#d9ff8e;color:#000;text-align:center;padding:4px">16<br><code>10h</code></td><td style="background:#b8fa71;color:#000;text-align:center;padding:4px">17<br><code>11h</code></td><td style="background:#8ee56a;color:#000;text-align:center;padding:4px">18<br><code>12h</code></td><td style="background:#8cd58c;color:#000;text-align:center;padding:4px">19<br><code>13h</code></td><td style="background:#9ff8a4;color:#000;text-align:center;padding:4px">20<br><code>14h</code></td><td style="background:#43ec68;color:#000;text-align:center;padding:4px">21<br><code>15h</code></td><td style="background:#43df75;color:#000;text-align:center;padding:4px">22<br><code>16h</code></td><td style="background:#4bac71;color:#000;text-align:center;padding:4px">23<br><code>17h</code></td><td style="background:#333333;color:#000;text-align:center;padding:4px">24<br><code>18h</code></td><td style="background:#5b5b5b;color:#000;text-align:center;padding:4px">25<br><code>19h</code></td><td style="background:#888888;color:#000;text-align:center;padding:4px">26<br><code>1Ah</code></td><td style="background:#ffffff;color:#000;text-align:center;padding:4px">27<br><code>1Bh</code></td><td style="background:#ff9b9b;color:#000;text-align:center;padding:4px">28<br><code>1Ch</code></td><td style="background:#ff4d5a;color:#000;text-align:center;padding:4px">29<br><code>1Dh</code></td><td style="background:#d63f49;color:#000;text-align:center;padding:4px">30<br><code>1Eh</code></td><td style="background:#98454b;color:#000;text-align:center;padding:4px">31<br><code>1Fh</code></td></tr>
<tr><td style="background:#f7e7bd;color:#000;text-align:center;padding:4px">32<br><code>20h</code></td><td style="background:#ffbd45;color:#000;text-align:center;padding:4px">33<br><code>21h</code></td><td style="background:#d5845d;color:#000;text-align:center;padding:4px">34<br><code>22h</code></td><td style="background:#b58b85;color:#000;text-align:center;padding:4px">35<br><code>23h</code></td><td style="background:#fff486;color:#000;text-align:center;padding:4px">36<br><code>24h</code></td><td style="background:#f0f65a;color:#000;text-align:center;padding:4px">37<br><code>25h</code></td><td style="background:#d6e85d;color:#000;text-align:center;padding:4px">38<br><code>26h</code></td><td style="background:#acbb67;color:#000;text-align:center;padding:4px">39<br><code>27h</code></td><td style="background:#d9ff8e;color:#000;text-align:center;padding:4px">40<br><code>28h</code></td><td style="background:#b8fa71;color:#000;text-align:center;padding:4px">41<br><code>29h</code></td><td style="background:#8ee56a;color:#000;text-align:center;padding:4px">42<br><code>2Ah</code></td><td style="background:#8cd58c;color:#000;text-align:center;padding:4px">43<br><code>2Bh</code></td><td style="background:#9ff8a4;color:#000;text-align:center;padding:4px">44<br><code>2Ch</code></td><td style="background:#43ec68;color:#000;text-align:center;padding:4px">45<br><code>2Dh</code></td><td style="background:#43df75;color:#000;text-align:center;padding:4px">46<br><code>2Eh</code></td><td style="background:#4bac71;color:#000;text-align:center;padding:4px">47<br><code>2Fh</code></td></tr>
<tr><td style="background:#333333;color:#000;text-align:center;padding:4px">48<br><code>30h</code></td><td style="background:#5b5b5b;color:#000;text-align:center;padding:4px">49<br><code>31h</code></td><td style="background:#888888;color:#000;text-align:center;padding:4px">50<br><code>32h</code></td><td style="background:#ffffff;color:#000;text-align:center;padding:4px">51<br><code>33h</code></td><td style="background:#ff9b9b;color:#000;text-align:center;padding:4px">52<br><code>34h</code></td><td style="background:#ff4d5a;color:#000;text-align:center;padding:4px">53<br><code>35h</code></td><td style="background:#d63f49;color:#000;text-align:center;padding:4px">54<br><code>36h</code></td><td style="background:#98454b;color:#000;text-align:center;padding:4px">55<br><code>37h</code></td><td style="background:#f7e7bd;color:#000;text-align:center;padding:4px">56<br><code>38h</code></td><td style="background:#ffbd45;color:#000;text-align:center;padding:4px">57<br><code>39h</code></td><td style="background:#d5845d;color:#000;text-align:center;padding:4px">58<br><code>3Ah</code></td><td style="background:#b58b85;color:#000;text-align:center;padding:4px">59<br><code>3Bh</code></td><td style="background:#fff486;color:#000;text-align:center;padding:4px">60<br><code>3Ch</code></td><td style="background:#f0f65a;color:#000;text-align:center;padding:4px">61<br><code>3Dh</code></td><td style="background:#d6e85d;color:#000;text-align:center;padding:4px">62<br><code>3Eh</code></td><td style="background:#acbb67;color:#000;text-align:center;padding:4px">63<br><code>3Fh</code></td></tr>
<tr><td style="background:#d9ff8e;color:#000;text-align:center;padding:4px">64<br><code>40h</code></td><td style="background:#b8fa71;color:#000;text-align:center;padding:4px">65<br><code>41h</code></td><td style="background:#8ee56a;color:#000;text-align:center;padding:4px">66<br><code>42h</code></td><td style="background:#8cd58c;color:#000;text-align:center;padding:4px">67<br><code>43h</code></td><td style="background:#9ff8a4;color:#000;text-align:center;padding:4px">68<br><code>44h</code></td><td style="background:#43ec68;color:#000;text-align:center;padding:4px">69<br><code>45h</code></td><td style="background:#43df75;color:#000;text-align:center;padding:4px">70<br><code>46h</code></td><td style="background:#4bac71;color:#000;text-align:center;padding:4px">71<br><code>47h</code></td><td style="background:#333333;color:#000;text-align:center;padding:4px">72<br><code>48h</code></td><td style="background:#5b5b5b;color:#000;text-align:center;padding:4px">73<br><code>49h</code></td><td style="background:#888888;color:#000;text-align:center;padding:4px">74<br><code>4Ah</code></td><td style="background:#ffffff;color:#000;text-align:center;padding:4px">75<br><code>4Bh</code></td><td style="background:#ff9b9b;color:#000;text-align:center;padding:4px">76<br><code>4Ch</code></td><td style="background:#ff4d5a;color:#000;text-align:center;padding:4px">77<br><code>4Dh</code></td><td style="background:#d63f49;color:#000;text-align:center;padding:4px">78<br><code>4Eh</code></td><td style="background:#98454b;color:#000;text-align:center;padding:4px">79<br><code>4Fh</code></td></tr>
<tr><td style="background:#f7e7bd;color:#000;text-align:center;padding:4px">80<br><code>50h</code></td><td style="background:#ffbd45;color:#000;text-align:center;padding:4px">81<br><code>51h</code></td><td style="background:#d5845d;color:#000;text-align:center;padding:4px">82<br><code>52h</code></td><td style="background:#b58b85;color:#000;text-align:center;padding:4px">83<br><code>53h</code></td><td style="background:#fff486;color:#000;text-align:center;padding:4px">84<br><code>54h</code></td><td style="background:#f0f65a;color:#000;text-align:center;padding:4px">85<br><code>55h</code></td><td style="background:#d6e85d;color:#000;text-align:center;padding:4px">86<br><code>56h</code></td><td style="background:#acbb67;color:#000;text-align:center;padding:4px">87<br><code>57h</code></td><td style="background:#d9ff8e;color:#000;text-align:center;padding:4px">88<br><code>58h</code></td><td style="background:#b8fa71;color:#000;text-align:center;padding:4px">89<br><code>59h</code></td><td style="background:#8ee56a;color:#000;text-align:center;padding:4px">90<br><code>5Ah</code></td><td style="background:#8cd58c;color:#000;text-align:center;padding:4px">91<br><code>5Bh</code></td><td style="background:#9ff8a4;color:#000;text-align:center;padding:4px">92<br><code>5Ch</code></td><td style="background:#43ec68;color:#000;text-align:center;padding:4px">93<br><code>5Dh</code></td><td style="background:#43df75;color:#000;text-align:center;padding:4px">94<br><code>5Eh</code></td><td style="background:#4bac71;color:#000;text-align:center;padding:4px">95<br><code>5Fh</code></td></tr>
<tr><td style="background:#333333;color:#000;text-align:center;padding:4px">96<br><code>60h</code></td><td style="background:#5b5b5b;color:#000;text-align:center;padding:4px">97<br><code>61h</code></td><td style="background:#888888;color:#000;text-align:center;padding:4px">98<br><code>62h</code></td><td style="background:#ffffff;color:#000;text-align:center;padding:4px">99<br><code>63h</code></td><td style="background:#ff9b9b;color:#000;text-align:center;padding:4px">100<br><code>64h</code></td><td style="background:#ff4d5a;color:#000;text-align:center;padding:4px">101<br><code>65h</code></td><td style="background:#d63f49;color:#000;text-align:center;padding:4px">102<br><code>66h</code></td><td style="background:#98454b;color:#000;text-align:center;padding:4px">103<br><code>67h</code></td><td style="background:#f7e7bd;color:#000;text-align:center;padding:4px">104<br><code>68h</code></td><td style="background:#ffbd45;color:#000;text-align:center;padding:4px">105<br><code>69h</code></td><td style="background:#d5845d;color:#000;text-align:center;padding:4px">106<br><code>6Ah</code></td><td style="background:#b58b85;color:#000;text-align:center;padding:4px">107<br><code>6Bh</code></td><td style="background:#fff486;color:#000;text-align:center;padding:4px">108<br><code>6Ch</code></td><td style="background:#f0f65a;color:#000;text-align:center;padding:4px">109<br><code>6Dh</code></td><td style="background:#d6e85d;color:#000;text-align:center;padding:4px">110<br><code>6Eh</code></td><td style="background:#acbb67;color:#000;text-align:center;padding:4px">111<br><code>6Fh</code></td></tr>
<tr><td style="background:#d9ff8e;color:#000;text-align:center;padding:4px">112<br><code>70h</code></td><td style="background:#b8fa71;color:#000;text-align:center;padding:4px">113<br><code>71h</code></td><td style="background:#8ee56a;color:#000;text-align:center;padding:4px">114<br><code>72h</code></td><td style="background:#8cd58c;color:#000;text-align:center;padding:4px">115<br><code>73h</code></td><td style="background:#9ff8a4;color:#000;text-align:center;padding:4px">116<br><code>74h</code></td><td style="background:#43ec68;color:#000;text-align:center;padding:4px">117<br><code>75h</code></td><td style="background:#43df75;color:#000;text-align:center;padding:4px">118<br><code>76h</code></td><td style="background:#4bac71;color:#000;text-align:center;padding:4px">119<br><code>77h</code></td><td style="background:#333333;color:#000;text-align:center;padding:4px">120<br><code>78h</code></td><td style="background:#5b5b5b;color:#000;text-align:center;padding:4px">121<br><code>79h</code></td><td style="background:#888888;color:#000;text-align:center;padding:4px">122<br><code>7Ah</code></td><td style="background:#ffffff;color:#000;text-align:center;padding:4px">123<br><code>7Bh</code></td><td style="background:#ff9b9b;color:#000;text-align:center;padding:4px">124<br><code>7Ch</code></td><td style="background:#ff4d5a;color:#000;text-align:center;padding:4px">125<br><code>7Dh</code></td><td style="background:#d63f49;color:#000;text-align:center;padding:4px">126<br><code>7Eh</code></td><td style="background:#98454b;color:#000;text-align:center;padding:4px">127<br><code>7Fh</code></td></tr>
</table>

## Flashing colour

When sending flashing colour, the colour flashes between that set as static or pulsing colour (A), and that contained in the MIDI event setting flashing (B), at 50% duty cycle, synchronized to the MIDI beat clock (or 120bpm or the last clock if no clock is provided). One period is one beat long.

## Pulsing colour

The colour pulses between dark and full intensity, synchronised to the MIDI beat clock (or 120bpm or the last clock if no clock is provided). One period is two beats long, using the following waveform:

## RGB colour

Pads and fader buttons can also be set to a custom colour using the following SysEx

Regular SKUs:

 Hex: F0h 00h 20h 29h 02h 14h 01h 43h <padID> <R> <G> <B> F7h Dec: 240 0 32 41 2 20 1 67 <padID> <R> <G> <B> 247

Mini SKUs:

 Hex: F0h 00h 20h 29h 02h 13h 01h 43h <padID> <R> <G> <B> F7h Dec: 240 0 32 41 2 19 1 67 <padID> <R> <G> <B> 247
## Controlling the screen
## Concepts
- Stationary display: A default display which is shown unless any event requires a different display to be temporarily shown above it.
- Temporary display: A display triggered by an event, persisting for the length of the display timeout user setting.
- Parameter name: Used in association with a control, showing what it is controlling. Unless provided by messages (SysEx), typically this is the MIDI entity (such as note or CC).
- Parameter value: Used in association with a control, showing the current value of it. Unless provided by messages (SysEx), this is the raw value of the MIDI entity controlled (such as a number in range 0 - 127 in case of a 7 bits CC).

## Configure displays

Regular SKUs:

 Hex: F0h 00h 20h 29h 02h 14h 04h <target> <config> F7h Dec: 240 0 32 41 2 20 4 <target> <config> 247

Mini SKUs:

 Hex: F0h 00h 20h 29h 02h 13h 04h <target> <config> F7h Dec: 240 0 32 41 2 19 4 <target> <config> 247

Once a display is configured for a given target, it can be triggered.
## Targets
- 00h (0) - 1Fh (31): Temp. display for Analogue controls (same as CC indices, 05h-0Dh: Faders, 15h-1Ch: encoders)
- 20h (32): Stationary display
- 21h (33): Global temporary display (can be used for anything unrelated to the Analogue controls)
- 22h (34): DAW pad mode's displayed name (Field 0, empty: default)
- 23h (35): DAW Drum pad mode's displayed name (Field 0, empty: default)
- 24h (36): Mixer encoder mode's displayed name (Field 0, empty: default)
- 25h (37): Plugin encoder mode's displayed name (Field 0, empty: default)
- 26h (38): Sends encoder mode's displayed name (Field 0, empty: default)
- 27h (39): Transport encoder mode's displayed name (Field 0, empty: default)
- 28h (40): Volume fader mode's displayed name (Field 0, empty: default)

## Config

The <config> byte sets up the arrangement and operation of the display. 00h and 7Fh are special values: It cancels (00h) or brings up (7Fh) the display with its current contents (as MIDI Event, it is a compact way to trigger display).
- Bit 6: Allow Launchkey to generate Temp. Display automatically on Change (default: Set).
- Bit 5: Allow Launchkey to generate Temp. Display automatically on Touch (default: Set; this is the Shift + rotate).
- Bit 0-4: Display arrangement
## Display arrangements
- 0: Special value for cancelling display.
- 1-30: Arrangement IDs, see table below.
- 31: Special value for triggering display.

 ID Description Num Fields F0 F1 F2

 1 2 lines: Parameter Name and Text Parameter Value No 2 Name Value -

 2 3 lines: Title, Parameter Name and Text Parameter Value No 3 Title Name Value

 3 1 line + 2x4: Title and 8 names (for encoder No 9 Title Name1 ... designations)

 4 2 lines: Parameter Name and Numeric Parameter Value Yes 1 Name - - (default)

 NOTE The arrangement is ignored for targets only setting names (22h(34) - 28h(40)), however for changing triggerability, it needs to be set non-zero (since the value 0 for these still acts for cancelling the display).

## Setting text

Once a display is configured, the following message can be used to fill in the text fields.

Regular SKUs:

 Hex: F0h 00h 20h 29h 02h 14h 06h <target> <field> <text…> F7h Dec: 240 0 32 41 2 20 6 <target> <field> <text…> 247

Mini SKUs:

 Hex: F0h 00h 20h 29h 02h 13h 06h <target> <field> <text…> F7h Dec: 240 0 32 41 2 19 6 <target> <field> <text…> 247

The text uses the standard ASCII character mapping in the range 20h (32) - 7Eh (126) with the addition of the below control codes, which have been reassigned to provide additional non-ASCII characters.
- Empty Box - 1Bh (27)
- Filled Box - 1Ch (28)
- Flat Symbol - 1Dh (29)
- Heart - 1Eh (30)

Other control characters should not be used as their behaviour may change in the future.

## Bitmap

The screen can also display custom graphics by sending a bitmap to the device.

Regular SKUs:

 Hex: F0h 00h 20h 29h 02h 14h 09h <target> <bitmap_data> 7Fh Dec: 240 0 32 41 2 20 9 <target> <bitmap_data> 127

Mini SKUs:

 Hex: F0h 00h 20h 29h 02h 13h 09h <target> <bitmap_data> 7Fh Dec: 240 0 32 41 2 19 9 <target> <bitmap_data> 127

The <target> can be either the Stationary display (20h(32)) or the Global temporary display (21h(33)). There is no effect on other targets.

The <bitmap_data> is of fixed 1216 bytes, 19 bytes for each pixel row, for a total of 64 rows (19 × 64 = 1216). The 7 bits of the SysEx byte encode pixels from left to right (highest bit corresponding to the leftmost pixel), the 19 bytes covering the 128 pixels width of the display (with five unused bits in the last byte).

Upon success, there is a response to this message, which is suitable for timing fluid animations (once receiving it, the Launchkey is ready to accept a next Bitmap message):

Regular SKUs:

 Hex: F0h 00h 20h 29h 02h 14h 09h 7Fh Dec: 240 0 32 41 2 20 9 127

Mini SKUs:

 Hex: F0h 00h 20h 29h 02h 13h 09h 7Fh Dec: 240 0 32 41 2 19 9 127

The display can be cancelled by either cancelling it explicitly (using the Configure Display SysEx or MIDI Event), or triggering the normal display (whose parameters are preserved while the bitmap is displaying).

 NOTE The firmware can only hold one bitmap in its memory at once.
# Launchkey MK4 feature controls
Many of the Launchkey’s features can be controlled by MIDI CC messages sent to the Launchkey's DAW in port on channel 7 and queried by sending the same message to channel 8. Reply messages confirming changes or answering queries will always be sent on channel 7.

To enable or disable these controls in standalone mode, use the below messages.

Enable feature controls:

 Hex: 9Fh 0Bh 7Fh Dec: 159 11 127

Disable feature controls:

 Hex: 9Fh 0Bh 00h Dec: 159 11 0

 NOTE
- In DAW mode, all feature controls are listening, but will not send the confirmation reply except for a few essential ones.
- In DAW mode, the above messages can be used to turn fully on all of them or revert to the DAW set.
- The CC messages must be sent to the Launchkey's DAW in MIDI port.
- Nibble-Split controls use the least significant nibble of two CC values to create an 8-bit value. The first CCs value becomes the most significant nibble.
- Features marked with (*) are non-volatile, persisting across power cycles.
- Features marked with (#) are always fully enabled in DAW mode.

CC Number / Feature / Control Type

| Hex | Decimal | Feature | Control type |
|---|---:|---|---|
| 02h:22h | 2:34 | Arp Swing 2's complement signed 14 bits | percentage |
| 03h:23h | 3:35 | Tempo control |  |
| 04h: 24h | 4:36 | Arp Deviate rhythm pattern nibble-split bitmask |  |
| 05h: 25h | 5:37 | Arp Ties nibble-split bitmask |  |
| 06h: 26h | 6:38 | Arp Accents nibble-split bitmask |  |
| 07h: 27h | 7:39 | Arp Ratchets nibble-split bitmask |  |
| 1Dh (#) | 29 | Pads layout select |  |
| 1Eh (#) | 30 | Encoders layout select |  |
| 1Fh (#) | 31 | Faders layout select |  |
| 3Ch | 60 | Scale behaviour select |  |
| 3Dh (#) | 61 | Scale tonic (root note) select |  |
| 3Eh (#) | 62 | Scale mode (type) select |  |
| 3Fh (#) | 63 | Shift |  |
| 44h | 68 | DAW 14-bits Analogue output | On/Off |
| 45h | 69 | DAW Encoder Relative output | On/Off |
| 46h | 70 | DAW Fader Pickup | On/Off |
| 47h | 71 | DAW Touch events | On/Off |
| 49h | 73 | Arp | On/Off |
| 4Ah | 74 | Scale mode | On/Off |
| 4Ch | 76 | DAW Performance note redirect (When On, Keybed notes go to DAW) | On/Off |
| 4Dh | 77 | Keyboard Zones, mode | 0: Part A, 1: Part B, 2: Split, 3: Layer |
| 4Eh | 78 | Keyboard Zones, split key | MIDI note on default octave keybed |
| 4Fh (*) | 79 | Keyboard Zones, Arp connection select | 0: Part A, 1: Part B |
| 53h | 83 | DAW Drumrack active colour |  |
| 54h | 84 | DAW Drumrack On / Off (When Off, Drumrack remains in MIDI mode while in DAW mode) |  |
| 55h | 85 | Arp Type (Up / Down etc.) |  |
| 56h | 86 | Arp Rate (including Triplets) |  |
| 57h | 87 | Arp Octave |  |
| 58h | 88 | Arp Latch | On/Off |
| 59h | 89 | Arp Gate length | percentage |
| 5Ah | 90 | Arp Gate minimum | milliseconds |
| 5Ch | 92 | Arp Mutate |  |
| 64h (*) | 100 | MIDI Channel, Part A (or Keybed MIDI Channel for SKUs not having keyboard split) | 0-15 |
| 65h (*) | 101 | MIDI Channel, Part B (only used on SKUs having keyboard split) | 0-15 |
| 66h (*) | 102 | MIDI Channel, Chords | 0-15 |
| 67h (*) | 103 | MIDI Channel, Drums | 0-15 |
| 68h (*) | 104 | Keys velocity curve / Fixed velocity select |  |
| 69h (*) | 105 | Pads velocity curve / Fixed velocity select |  |
| 6Ah (*) | 106 | Fixed velocity value |  |
| 6Bh (*) | 107 | Arp velocity (whether Arp should take velocity from its note input or use fixed velocity) |  |
| 6Ch (*) | 108 | Pad aftertouch type |  |
| 6Dh (*) | 109 | Pad aftertouch threshold |  |
| 6Eh (*) | 110 | MIDI Clock output | On/Off |
| 6Fh (*) | 111 | LED brightness level | 0-127 (0 min, 127 max) |
| 70h (*) | 112 | Screen brightness level | 0-127 (0 min, 127 max) |
| 71h (*) | 113 | Temporary display timeout | 1/10-second units; minimum 1 second at 0 |
| 72h (*) | 114 | Vegas mode | On/Off |
| 73h (*) | 115 | External Feedback | On/Off |
| 74h (*) | 116 | Pads power-on default mode select |  |
| 75h (*) | 117 | Pots power-on default mode select |  |
| 76h (*) | 118 | Faders power-on default mode select |  |
| 77h (*) | 119 | Custom Mode Fader pick-up | 0 : Jump, 1 : Pickup |
| 7Ah | 122 | Chord Map Adventure setting | 1-5 |
| 7Bh | 123 | Chord Map Explore setting | 1-8 |
| 7Ch | 124 | Chord Map Spread setting | 0-2 |
| 7Dh | 125 | Chord Map Roll setting | 0-100 milliseconds |
