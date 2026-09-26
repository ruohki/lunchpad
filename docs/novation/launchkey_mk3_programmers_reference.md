# Launchkey MK3 Programmer’s Reference Manual

> Converted from the official Focusrite PDF. Figure-based MIDI mappings have been transcribed into accessible tables.

# About this Guide
This document provides all the information you need to be able to control the Launchkey MK3.

The Launchkey MK3 communicates using MIDI over USB and DIN. This document describes the MIDI implementation for the device, the MIDI events coming from it, and how the Launchkey MK3’s various features can be accessed through MIDI messages.

MIDI data is expressed in this manual in several different ways:

-   A plain English description of the message.
-   When we describe a musical note, middle C is deemed to be ‘C3’ or note 60. MIDI channel 1
is the lowest-numbered MIDI channel: channels range from 1 - 16.
-   MIDI messages are also expressed in plain data, with decimal and hexadecimal equivalents.
The hexadecimal number will always be followed by an ‘h’ and the decimal equivalent given in brackets. For example, a note on message on channel 1 is signified by the status byte 90h (144).

# Bootloader
The Launchkey MK3 has a bootloader mode that allows the user to configure and save certain settings. The bootloader is accessed by holding the Octave Up and Octave Down buttons together whilst plugging the device in.

The Fixed Chord button can be used to toggle Easy Start. When Easy Start is ON, the Launchkey MK3 shows up as a Mass Storage Device to provide a more convenient first-time experience. You can turn this off once you are familiar with the device to disable this Mass Storage Device.

The Scene Launch button can be used to request displaying the Bootloader’s version number. The Stop Solo Mute button can then be used to switch back to displaying the Application’s. On the Launchkey MK3, these display in a conveniently readable format on the LCD, however like other Novation products, the digits of the version number also show on the pads, each digit represented by its binary form.

The Device Select, Device Lock or the Play button can be used to start the Application (of these only the Device Lock button lights up as the other two have no LEDs to illuminate them).

# MIDI on Launchkey MK3
The Launchkey MK3 has two MIDI interfaces providing two pairs of MIDI inputs and outputs over USB. They are as follows:

-   LKMK3 MIDI In / Out (or first interface on Windows): This interface is used to receive MIDI
from performing (keys, wheels, pad, pot, and fader Custom Modes); and is used to provide external MIDI input.
-   LKMK3 DAW In / Out (or second interface on Windows): This interface is used by DAWs and
similar software to interact with the Launchkey MK3.

The Launchkey MK3 also has a MIDI DIN output port, which transmits the same data as the LKMK3 MIDI In (USB) interface. Note that responses to requests sent on LKMK3 MIDI Out (USB) are only returned on LKMK3 MIDI In (USB).

If you wish to use Launchkey MK3 as a control surface for a DAW (Digital Audio Workstation), you will likely want to use the DAW interface (See DAW mode chapter).

Otherwise, you may interact with the device using the MIDI interface.

The Launchkey MK3 sends Note On (90h - 9Fh) with velocity zero for Note Offs. It accepts either Note Offs (80h - 8Fh) or Note Ons (90h - 9Fh) with velocity zero for Note Off.

## Device Inquiry message
The Launchkey MK3 responds to the Universal Device Inquiry Sysex message, which can be used to identify the device. This exchange is as follows:
Host => Launchkey MK3:
```text
Hex:    F0h 7Eh 7Fh 06h 01h F7h
```
```text
Dec:    240 126 127 6 1 247
```

Launchkey MK3 => Host (Application):
```text
Hex:    F0h 7Eh 00h 06h 02h 00h 20h 29h <dev_type>   01h 00h 00h <app_version>    F7h
```
```text
Dec:    240 126 0 6 2 0 32 41 <dev_type>             1 0 0 <app_version>          247
```

Launchkey MK3 => Host (Bootloader):
```text
Hex:    F0h 7Eh 00h 06h 02h 00h 20h 29h <dev_type>   11h 00h 00h <boot_version>   F7h
```
```text
Dec:    240 126 0 6 2 0 32 41 <dev_type>             17 0 0 <boot_version>        247
```

The <dev_type> field encodes which Launchkey MK3 is connected:

-   34h (52): Launchkey MK3 25
-   35h (53): Launchkey MK3 37
-   36h (54): Launchkey MK3 49
-   37h (55): Launchkey MK3 61

The <app_version> or <boot_version> field is 4 bytes long, providing the Application or the Bootloader version, respectively. The version is the same version which can be viewed using the Scene Launch and Stop-Solo-Mute buttons in the Bootloader, provided as four bytes, each byte corresponding to one digit, ranging from 0 - 9.

## SysEx message format used by the device
All SysEx messages begin with the following header regardless of direction (Host => Launchkey MK3 or Launchkey MK3 => Host):
```text
Hex:   F0h 00h 20h 29h 02h 0Fh
```
```text
Dec:   240 0 32 41 2 15
```

After the header, a command byte follows, selecting the function to use.

# Standalone (MIDI) mode
The Launchkey MK3 powers up into Standalone mode. This mode does not provide specific functionality for interaction with DAWs, the DAW in / out (USB) interface remains unused for this purpose. However, to provide means for capturing events on all the Launchkey MK3’s buttons, they do send MIDI Control Change events on Channel 16 (Midi status: BFh, 191) on the MIDI in / out (USB) interface and the MIDI DIN port:

| Surface control/location | Decimal CC | Hex CC |
|---|---:|---:|
| Track Left | 102 | 66h |
| Track Right | 103 | 67h |
| Left pad-side button, upper | 106 | 6Ah |
| Left pad-side button, lower | 107 | 6Bh |
| Right pad-side button, upper | 104 | 68h |
| Right pad-side button, lower | 105 | 69h |
| Mode button, up | 51 | 33h |
| Mode button, down | 52 | 34h |
| Right-hand button group, upper 1-4 | 74, 75, 76, 77 | 4Ah, 4Bh, 4Ch, 4Dh |
| Right-hand button group, lower 1-4 | 115, 116, 117, 118 | 73h, 74h, 75h, 76h |

When creating Custom Modes for the Launchkey MK3, keep these in mind if you are setting up a Custom Mode to operate on MIDI Channel 16.

# DAW mode
DAW mode provides functionality for DAWs and DAW like software to realize intuitive user interfaces on the Launchkey MK3’s surface. The capabilities described in this chapter are only available once DAW mode is enabled.

All functionality described in this chapter are accessible through the LKMK3 DAW In / Out (USB) interface only.

## DAW mode control
The following MIDI events are used to set DAW mode:

-   Channel 16, Note 0Ch (12): DAW mode enable / disable.
-   Channel 16, Note 0Bh (11): Continuous control Touch event enable / disable.
-   Channel 16, Note 0Ah (10): Continuous control Pot Pickup enable / disable.

By default, upon entry to DAW mode, Continuous control Touch events are disabled, and Continuous control Pot Pickup is disabled.

A Note On event enters DAW mode or enables the respective feature, while a Note Off event exits DAW mode or disables the respective feature.

When the DAW or DAW like software recognizes the Launchkey MK3 and connects to it, first it should enter DAW mode (send 9Fh 0Ch 7Fh), and then, if necessary, enable the features it needs.

When the DAW or DAW like software exits, it should exit from DAW mode on the Launchkey MK3 (send 9Fh 0Ch 00h) to return it to Standalone (MIDI) mode.

## The Launchkey MK3’s surface in DAW mode
In DAW mode, contrary to Standalone (MIDI) mode, all buttons and surface elements not belonging to performing (such as the Custom Modes) can be accessed and will report on the LKMK3 DAW In / Out (USB) interface only. The buttons except for those belonging to the Faders are mapped to Control Change events as follows:

| Surface control/location | Decimal CC | Hex CC |
|---|---:|---:|
| Device Select | 108 | 6Ch |
| Track Left | 102 | 66h |
| Track Right | 103 | 67h |
| Left pad-side button, upper | 106 | 6Ah |
| Left pad-side button, lower | 107 | 6Bh |
| Scene Up | 104 | 68h |
| Scene Down | 105 | 69h |
| Mode button, up | 51 | 33h |
| Mode button, down | 52 | 34h |
| Right-hand button group, upper 1-4 | 74, 75, 76, 77 | 4Ah, 4Bh, 4Ch, 4Dh |
| Right-hand button group, lower 1-4 | 115, 116, 117, 118 | 73h, 74h, 75h, 76h |

Note that to provide some degree of script compatibility with the Launchkey Mini MK3, the Scene Up and Scene Down buttons also report back CC 68h (104) and 69h (105) respectively on Channel 16.

The Control Change indices listed are also used for sending colour to the corresponding LEDs (if the button has any), see the Colouring the surface chapter further below.

## Additional modes available in DAW mode
Once in DAW mode, the following additional modes become available:

-   Session and Device Select mode on the Pads.
-   Device, Volume, Pan, Send-A and Send-B on the Pots.
-   Device, Volume, Send-A and Send-B on the Faders (LK 49 / 61 only).

When entering DAW mode, the surface is set up the following manner:

-   Pads: Session.
-   Pots: Pan.
-   Faders: Volume (LK 49 / 61 only).

The DAW should initialize each of these areas accordingly.

## Mode report and select
The modes of the Pads, Pots and Faders can be controlled by Midi events, and are also reported back by the Launchkey MK3 whenever it changes mode due to user activity. These messages are important to capture as the DAW should follow these setting up and using the surfaces as intended based on the selected mode.

## Pad modes
Pad mode changes are reported or can be changed by the following Midi event:

-   Channel 16 (Midi status: BFh, 191), Control Change 03h (3)

The Pad modes are mapped to the following values:

-   00h (0): Custom Mode 0
-   01h (1): Drum layout
-   02h (2): Session layout
-   03h (3): Scale Chords
-   04h (4): User Chords
-   05h (5): Custom Mode 0
-   06h (6): Custom Mode 1
-   07h (7): Custom Mode 2
-   08h (8): Custom Mode 3
-   09h (9): Device Select
-   0Ah (10): Navigation

## Pot modes
Pot mode changes are reported or can be changed by the following Midi event:

-   Channel 16 (Midi status: BFh, 191), Control Change 09h (9)

The Pot modes are mapped to the following values:

-   00h (0): Custom Mode 0
-   01h (1): Volume
-   02h (2): Device
-   03h (3): Pan
-   04h (4): Send-A
-   05h (5): Send-B
-   06h (6): Custom Mode 0
-   07h (7): Custom Mode 1
-   08h (8): Custom Mode 2
-   09h (9): Custom Mode 3

## Fader modes (LK 49 / 61 only)
Fader mode changes are reported or can be changed by the following Midi event:

-   Channel 16 (Midi status: BFh, 191), Control Change 0Ah (10)

The Fader modes are mapped to the following values:

-   00h (0): Custom Mode 0
-   01h (1): Volume
-   02h (2): Device
-   04h (4): Send-A
-   05h (5): Send-B
-   06h (6): Custom Mode 0
-   07h (7): Custom Mode 1
-   08h (8): Custom Mode 2
-   09h (9): Custom Mode 3

## Session mode
The Session mode on Pads is selected on entering DAW mode, and when the user selects it by the Shift menu. The pads report back as Note (Midi status: 90h, 144) and Aftertouch (Midi status: A0h, 160) events (the latter only if Polyphonic Aftertouch is selected) on Channel 1, and can be accessed for colouring their LEDs by the following indices:

| Pad row | Hex note indices | Decimal note indices |
|---|---|---|
| Top | 60h, 61h, 62h, 63h, 64h, 65h, 66h, 67h | 96, 97, 98, 99, 100, 101, 102, 103 |
| Bottom | 70h, 71h, 72h, 73h, 74h, 75h, 76h, 77h | 112, 113, 114, 115, 116, 117, 118, 119 |

## Drum mode
The Drum mode on Pads replaces the Drum mode of Standalone (MIDI) mode, providing a capability to the DAW to control its colours. The pads report back as Note (Midi status: 9Ah, 154) and Aftertouch (Midi status: AAh, 170) events (the latter only if Polyphonic Aftertouch is selected) on Channel 10, and can be accessed for colouring their LEDs by the following indices:

| Pad row | Hex note indices | Decimal note indices |
|---|---|---|
| Top | 28h, 29h, 2Ah, 2Bh, 30h, 31h, 32h, 33h | 40, 41, 42, 43, 48, 49, 50, 51 |
| Bottom | 24h, 25h, 26h, 27h, 2Ch, 2Dh, 2Eh, 2Fh | 36, 37, 38, 39, 44, 45, 46, 47 |

## Device Select mode
The Device Select mode on Pads is selected automatically when holding down the Device Select button (the Launchkey MK3 sends out the corresponding Mode Report messages upon pressing the button down and releasing it). The pads report back as Note (Midi status: 90h, 144) and Aftertouch (Midi status: A0h, 160) events (the latter only if Polyphonic Aftertouch is selected) on Channel 1 and can be accessed for colouring their LEDs by the following indices:

| Pad row | Hex note indices | Decimal note indices |
|---|---|---|
| Top | 40h, 41h, 42h, 43h, 44h, 45h, 46h, 47h | 64, 65, 66, 67, 68, 69, 70, 71 |
| Bottom | 50h, 51h, 52h, 53h, 54h, 55h, 56h, 57h | 80, 81, 82, 83, 84, 85, 86, 87 |

## Pot modes
The Pots in all the following modes provide the same set of Control Changes on Channel 16 (Midi status: BFh, 191):

-   Device
-   Volume
-   Pan
-   Send-A
-   Send-B

The Control Change indices are:

| Pot | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Hex CC | 15h | 16h | 17h | 18h | 19h | 1Ah | 1Bh | 1Ch |
| Decimal CC | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 |

If Continuous Control Touch events are enabled, the Touch On is sent as a Control Change event with Value 127 on Channel 15, while the Touch Off is sent as a Control Change event with Value 0 on Channel 15. For example, the leftmost Pot would send BEh 15h 7Fh for Touch On, and BEh 15h 00h for Touch Off.

## Fader modes (LK 49 / 61 only)
The Faders in all the following modes provide the same set of Control Changes on Channel 16 (Midi status: BFh, 191):

-   Device
-   Volume
-   Send-A
-   Send-B

The Control Change indices are:

| Fader | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | Master |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Fader hex CC | 35h | 36h | 37h | 38h | 39h | 3Ah | 3Bh | 3Ch | 3Dh |
| Fader decimal CC | 53 | 54 | 55 | 56 | 57 | 58 | 59 | 60 | 61 |
| Button hex CC | 25h | 26h | 27h | 28h | 29h | 2Ah | 2Bh | 2Ch | 2Dh |
| Button decimal CC | 37 | 38 | 39 | 40 | 41 | 42 | 43 | 44 | 45 |

If Continuous Control Touch events are enabled, the Touch On is sent as a Control Change event with Value 127 on Channel 15, while the Touch Off is sent as a Control Change event with Value 0 on Channel 15. For example, the leftmost Fader would send BEh 35h 7Fh for Touch On, and BEh 35h 00h for Touch Off.

## Colouring the surface
For all controls except the Drum mode, a Note, or a Control Change matching those described in the reports can be sent to colour the corresponding LED (if the control has any) on the following channels:

-   Channel 1: Set stationary colour.
-   Channel 2: Set flashing colour.
-   Channel 3: Set pulsing colour.
-   Channel 16: Set stationary grayscale colour (CC associated controls only).

For the Drum mode on Pads, the following channels apply:

-   Channel 10: Set stationary colour.
-   Channel 11: Set flashing colour.
-   Channel 12: Set pulsing colour.

The colour is selected from the colour palette by the Note event’s Velocity or the Control Change’s Value.

The following buttons accepting colour have a white LED, thus any colour displayed on them will be shown as a shade of gray:

-   Device Lock
-   Arm/Select (LK 49 / 61 only)

The following buttons providing MIDI events have no LED, thus any colour sent to them will be ignored:

-   Capture MIDI
-   Quantise
-   Click
-   Undo
-   Play
-   Stop
-   Record
-   Loop
-   Track Left
-   Track Right
-   Device Select
-   Shift

## Colour palette
When providing colours by MIDI notes or control changes, use the following palette (decimal index above hexadecimal index):

<table>
<tr><td style="background:#333;color:#000;text-align:center;padding:4px">0<br><code>00h</code></td><td style="background:#777;color:#000;text-align:center;padding:4px">1<br><code>01h</code></td><td style="background:#bbb;color:#000;text-align:center;padding:4px">2<br><code>02h</code></td><td style="background:#fff;color:#000;text-align:center;padding:4px">3<br><code>03h</code></td><td style="background:#faa;color:#000;text-align:center;padding:4px">4<br><code>04h</code></td><td style="background:#f55;color:#000;text-align:center;padding:4px">5<br><code>05h</code></td><td style="background:#d44;color:#000;text-align:center;padding:4px">6<br><code>06h</code></td><td style="background:#a55;color:#000;text-align:center;padding:4px">7<br><code>07h</code></td><td style="background:#fff0c5;color:#000;text-align:center;padding:4px">8<br><code>08h</code></td><td style="background:#ffb54a;color:#000;text-align:center;padding:4px">9<br><code>09h</code></td><td style="background:#dd8b61;color:#000;text-align:center;padding:4px">10<br><code>0Ah</code></td><td style="background:#ad7766;color:#000;text-align:center;padding:4px">11<br><code>0Bh</code></td><td style="background:#fff2a0;color:#000;text-align:center;padding:4px">12<br><code>0Ch</code></td><td style="background:#f4ff4a;color:#000;text-align:center;padding:4px">13<br><code>0Dh</code></td><td style="background:#d8e95a;color:#000;text-align:center;padding:4px">14<br><code>0Eh</code></td><td style="background:#9fae5e;color:#000;text-align:center;padding:4px">15<br><code>0Fh</code></td></tr>
<tr><td style="background:#d7ff83;color:#000;text-align:center;padding:4px">16<br><code>10h</code></td><td style="background:#a8ff3e;color:#000;text-align:center;padding:4px">17<br><code>11h</code></td><td style="background:#82df63;color:#000;text-align:center;padding:4px">18<br><code>12h</code></td><td style="background:#75bd69;color:#000;text-align:center;padding:4px">19<br><code>13h</code></td><td style="background:#baf5a4;color:#000;text-align:center;padding:4px">20<br><code>14h</code></td><td style="background:#50f15d;color:#000;text-align:center;padding:4px">21<br><code>15h</code></td><td style="background:#48d866;color:#000;text-align:center;padding:4px">22<br><code>16h</code></td><td style="background:#3da95a;color:#000;text-align:center;padding:4px">23<br><code>17h</code></td><td style="background:#a8ffa8;color:#000;text-align:center;padding:4px">24<br><code>18h</code></td><td style="background:#43ef72;color:#000;text-align:center;padding:4px">25<br><code>19h</code></td><td style="background:#45c969;color:#000;text-align:center;padding:4px">26<br><code>1Ah</code></td><td style="background:#49af6d;color:#000;text-align:center;padding:4px">27<br><code>1Bh</code></td><td style="background:#c8f6c8;color:#000;text-align:center;padding:4px">28<br><code>1Ch</code></td><td style="background:#50e8aa;color:#000;text-align:center;padding:4px">29<br><code>1Dh</code></td><td style="background:#48c39c;color:#000;text-align:center;padding:4px">30<br><code>1Eh</code></td><td style="background:#57a779;color:#000;text-align:center;padding:4px">31<br><code>1Fh</code></td></tr>
<tr><td style="background:#9af0e4;color:#000;text-align:center;padding:4px">32<br><code>20h</code></td><td style="background:#40e5e2;color:#000;text-align:center;padding:4px">33<br><code>21h</code></td><td style="background:#51c7bc;color:#000;text-align:center;padding:4px">34<br><code>22h</code></td><td style="background:#57ac91;color:#000;text-align:center;padding:4px">35<br><code>23h</code></td><td style="background:#b7dded;color:#000;text-align:center;padding:4px">36<br><code>24h</code></td><td style="background:#55d5ee;color:#000;text-align:center;padding:4px">37<br><code>25h</code></td><td style="background:#53bbd1;color:#000;text-align:center;padding:4px">38<br><code>26h</code></td><td style="background:#4b8eaa;color:#000;text-align:center;padding:4px">39<br><code>27h</code></td><td style="background:#acd3ff;color:#000;text-align:center;padding:4px">40<br><code>28h</code></td><td style="background:#55bcf2;color:#000;text-align:center;padding:4px">41<br><code>29h</code></td><td style="background:#5590c4;color:#000;text-align:center;padding:4px">42<br><code>2Ah</code></td><td style="background:#4779ae;color:#000;text-align:center;padding:4px">43<br><code>2Bh</code></td><td style="background:#9a8be5;color:#000;text-align:center;padding:4px">44<br><code>2Ch</code></td><td style="background:#5d5cff;color:#000;text-align:center;padding:4px">45<br><code>2Dh</code></td><td style="background:#5f65c9;color:#000;text-align:center;padding:4px">46<br><code>2Eh</code></td><td style="background:#58579d;color:#000;text-align:center;padding:4px">47<br><code>2Fh</code></td></tr>
<tr><td style="background:#b895ef;color:#000;text-align:center;padding:4px">48<br><code>30h</code></td><td style="background:#9852ed;color:#000;text-align:center;padding:4px">49<br><code>31h</code></td><td style="background:#8163cb;color:#000;text-align:center;padding:4px">50<br><code>32h</code></td><td style="background:#8365a5;color:#000;text-align:center;padding:4px">51<br><code>33h</code></td><td style="background:#f0a5df;color:#000;text-align:center;padding:4px">52<br><code>34h</code></td><td style="background:#f04ad8;color:#000;text-align:center;padding:4px">53<br><code>35h</code></td><td style="background:#ce58c4;color:#000;text-align:center;padding:4px">54<br><code>36h</code></td><td style="background:#a04b99;color:#000;text-align:center;padding:4px">55<br><code>37h</code></td><td style="background:#f4a0bd;color:#000;text-align:center;padding:4px">56<br><code>38h</code></td><td style="background:#ed4d9c;color:#000;text-align:center;padding:4px">57<br><code>39h</code></td><td style="background:#d05b8f;color:#000;text-align:center;padding:4px">58<br><code>3Ah</code></td><td style="background:#a75677;color:#000;text-align:center;padding:4px">59<br><code>3Bh</code></td><td style="background:#ff765e;color:#000;text-align:center;padding:4px">60<br><code>3Ch</code></td><td style="background:#e9ae54;color:#000;text-align:center;padding:4px">61<br><code>3Dh</code></td><td style="background:#d6b457;color:#000;text-align:center;padding:4px">62<br><code>3Eh</code></td><td style="background:#9aa05d;color:#000;text-align:center;padding:4px">63<br><code>3Fh</code></td></tr>
<tr><td style="background:#4eac55;color:#000;text-align:center;padding:4px">64<br><code>40h</code></td><td style="background:#5da77f;color:#000;text-align:center;padding:4px">65<br><code>41h</code></td><td style="background:#5987ca;color:#000;text-align:center;padding:4px">66<br><code>42h</code></td><td style="background:#5149ff;color:#000;text-align:center;padding:4px">67<br><code>43h</code></td><td style="background:#54a5a5;color:#000;text-align:center;padding:4px">68<br><code>44h</code></td><td style="background:#884ee5;color:#000;text-align:center;padding:4px">69<br><code>45h</code></td><td style="background:#c0a7b5;color:#000;text-align:center;padding:4px">70<br><code>46h</code></td><td style="background:#887786;color:#000;text-align:center;padding:4px">71<br><code>47h</code></td><td style="background:#ff5454;color:#000;text-align:center;padding:4px">72<br><code>48h</code></td><td style="background:#dcff7a;color:#000;text-align:center;padding:4px">73<br><code>49h</code></td><td style="background:#e9ff5a;color:#000;text-align:center;padding:4px">74<br><code>4Ah</code></td><td style="background:#bfff50;color:#000;text-align:center;padding:4px">75<br><code>4Bh</code></td><td style="background:#5cdb6d;color:#000;text-align:center;padding:4px">76<br><code>4Ch</code></td><td style="background:#55edb2;color:#000;text-align:center;padding:4px">77<br><code>4Dh</code></td><td style="background:#55d8ed;color:#000;text-align:center;padding:4px">78<br><code>4Eh</code></td><td style="background:#5f98ef;color:#000;text-align:center;padding:4px">79<br><code>4Fh</code></td></tr>
<tr><td style="background:#7955ef;color:#000;text-align:center;padding:4px">80<br><code>50h</code></td><td style="background:#c45af2;color:#000;text-align:center;padding:4px">81<br><code>51h</code></td><td style="background:#dc62a8;color:#000;text-align:center;padding:4px">82<br><code>52h</code></td><td style="background:#a36c52;color:#000;text-align:center;padding:4px">83<br><code>53h</code></td><td style="background:#ef9a52;color:#000;text-align:center;padding:4px">84<br><code>54h</code></td><td style="background:#deff5c;color:#000;text-align:center;padding:4px">85<br><code>55h</code></td><td style="background:#c8ef60;color:#000;text-align:center;padding:4px">86<br><code>56h</code></td><td style="background:#57ed67;color:#000;text-align:center;padding:4px">87<br><code>57h</code></td><td style="background:#a5fb8d;color:#000;text-align:center;padding:4px">88<br><code>58h</code></td><td style="background:#b8f4c7;color:#000;text-align:center;padding:4px">89<br><code>59h</code></td><td style="background:#a6eeee;color:#000;text-align:center;padding:4px">90<br><code>5Ah</code></td><td style="background:#b6d8f5;color:#000;text-align:center;padding:4px">91<br><code>5Bh</code></td><td style="background:#9bb5e8;color:#000;text-align:center;padding:4px">92<br><code>5Ch</code></td><td style="background:#c5b3e8;color:#000;text-align:center;padding:4px">93<br><code>5Dh</code></td><td style="background:#ed5de1;color:#000;text-align:center;padding:4px">94<br><code>5Eh</code></td><td style="background:#e949b2;color:#000;text-align:center;padding:4px">95<br><code>5Fh</code></td></tr>
<tr><td style="background:#ffc45a;color:#000;text-align:center;padding:4px">96<br><code>60h</code></td><td style="background:#eff35c;color:#000;text-align:center;padding:4px">97<br><code>61h</code></td><td style="background:#e9eb55;color:#000;text-align:center;padding:4px">98<br><code>62h</code></td><td style="background:#d6d367;color:#000;text-align:center;padding:4px">99<br><code>63h</code></td><td style="background:#a39958;color:#000;text-align:center;padding:4px">100<br><code>64h</code></td><td style="background:#62b56e;color:#000;text-align:center;padding:4px">101<br><code>65h</code></td><td style="background:#72c18b;color:#000;text-align:center;padding:4px">102<br><code>66h</code></td><td style="background:#6e6d9b;color:#000;text-align:center;padding:4px">103<br><code>67h</code></td><td style="background:#73758e;color:#000;text-align:center;padding:4px">104<br><code>68h</code></td><td style="background:#c59a74;color:#000;text-align:center;padding:4px">105<br><code>69h</code></td><td style="background:#f56a5b;color:#000;text-align:center;padding:4px">106<br><code>6Ah</code></td><td style="background:#f1aa99;color:#000;text-align:center;padding:4px">107<br><code>6Bh</code></td><td style="background:#eba178;color:#000;text-align:center;padding:4px">108<br><code>6Ch</code></td><td style="background:#fff28a;color:#000;text-align:center;padding:4px">109<br><code>6Dh</code></td><td style="background:#dcff87;color:#000;text-align:center;padding:4px">110<br><code>6Eh</code></td><td style="background:#dcff80;color:#000;text-align:center;padding:4px">111<br><code>6Fh</code></td></tr>
<tr><td style="background:#737287;color:#000;text-align:center;padding:4px">112<br><code>70h</code></td><td style="background:#f1efd2;color:#000;text-align:center;padding:4px">113<br><code>71h</code></td><td style="background:#d9f3dc;color:#000;text-align:center;padding:4px">114<br><code>72h</code></td><td style="background:#dfe9f2;color:#000;text-align:center;padding:4px">115<br><code>73h</code></td><td style="background:#e5dfef;color:#000;text-align:center;padding:4px">116<br><code>74h</code></td><td style="background:#afada8;color:#000;text-align:center;padding:4px">117<br><code>75h</code></td><td style="background:#c4c3bc;color:#000;text-align:center;padding:4px">118<br><code>76h</code></td><td style="background:#e5e9e7;color:#000;text-align:center;padding:4px">119<br><code>77h</code></td><td style="background:#e85d62;color:#000;text-align:center;padding:4px">120<br><code>78h</code></td><td style="background:#ac6262;color:#000;text-align:center;padding:4px">121<br><code>79h</code></td><td style="background:#99f176;color:#000;text-align:center;padding:4px">122<br><code>7Ah</code></td><td style="background:#5dad69;color:#000;text-align:center;padding:4px">123<br><code>7Bh</code></td><td style="background:#eee54d;color:#000;text-align:center;padding:4px">124<br><code>7Ch</code></td><td style="background:#b7ac78;color:#000;text-align:center;padding:4px">125<br><code>7Dh</code></td><td style="background:#eebc5b;color:#000;text-align:center;padding:4px">126<br><code>7Eh</code></td><td style="background:#c77d68;color:#000;text-align:center;padding:4px">127<br><code>7Fh</code></td></tr>
</table>

## Flashing colour
When sending Flashing colour, the colour flashes between that set as Static or Pulsing colour (A), and that contained in the MIDI event setting flashing (B), at 50% duty cycle, synchronized to the MIDI beat clock (or 120bpm or the last clock if no clock is provided). One period is one beat long.

## Pulsing colour
The colour pulses between dark and full intensity synchronized to the MIDI beat clock (or 120bpm or the last clock if no clock is provided). One period is two beats long, using the following waveform:

## Examples
For these examples, enter DAW mode so the pads are in Session mode to receive these messages.

Lighting the lower left pad static red:
Host => Launchkey MK3:
```text
Hex:    90h 70h 05h
```
```text
Dec:    144 112 5
```

This is Note On, Channel 1, Note number 70h (112), with Velocity 05h (5). The Channel specifies the lighting mode (static), the Note number the pad to light (which is the lower left one in Session mode), the Velocity the colour (which is Red, see Colour Palette).

Flashing the upper left pad green:
Host => Launchkey MK3:
```text
Hex:    91h 60h 13h
```
```text
Dec:    145 96 19
```

This is Note On, Channel 2, Note number 60h (96), with Velocity 13h (19). The Channel specifies the lighting mode (flashing), the Note number the pad to light (which is the upper left one in Session mode), the Velocity the colour (which is Green, see Colour Palette).

Pulsing the lower right pad blue:
Host => Launchkey MK3:
```text
Hex:    92h 77h 2Dh
```
```text
Dec:    146 119 45
```

This is Note On, Channel 3, Note number 77h (119), with Velocity 2Dh (45). The Channel specifies the lighting mode (pulsing), the Note number the pad to light (which is the lower right one in Session mode), the Velocity the colour (which is Blue, see Colour Palette).

Turning a colour off:
Host => Launchkey MK3:
```text
Hex:    90h 77h 00h
```
```text
Dec:    144 119 0
```

This is Note Off (Note On with Velocity of zero), Channel 1, Note number 77h (119), with Velocity 00h (0). The Channel specifies the lighting mode (static), the Note number the pad to light (which is the lower right one in Session mode), the Velocity the colour (which is blank, see Colour Palette). If the Pulsing colour was set up there with the previous message, this would turn it off. Alternatively, a Midi Note Off message can also be used for the same effect:
Host => Launchkey MK3:
```text
Hex:    80h 77h 00h
```
```text
Dec:    128 119 0
```

## Controlling the screen
In DAW mode the Launchkey MK3’s 16x2 character LCD screen can also be controlled to have it displaying specific values.

There are three display priorities used by the Launchkey MK3, which is important to understand to know what each of the messages would set up:

-   Default display, which is normally blank, and has the lowest priority.
-   Temporary display, which shows for 5 seconds after interacting with a control.
-   Menu display, which has the highest priority.

When using any of the messages in this group, the data will be buffered by the Launchkey MK3 and would be displayed whenever the corresponding display has to be shown. Sending a message to the Launchkey MK3 won’t necessarily alter the display immediately if a higher priority display is shown at that time (for example if the Launchkey MK3 is in its Settings menu), but will show once the higher priority displays are removed (for example by exiting from the Settings menu).

## Character encoding
The bytes of the SysEx messages controlling the screen are interpreted as follows:

-   00h (0) - 1Fh (31): Control characters, see below.
-   20h (32) - 7Eh (126): ASCII characters.
-   7Fh (127): Control character, should not be used.

Of the control characters, the followings are defined:

-   11h (17): ISO-8859-2 upper bank character on the next byte.

Other control characters should not be used as their behaviour may change in the future.

The ISO-8859-2 upper bank character’s code can be obtained by adding 80h (128) to the byte value. Not all characters are implemented, but all have a reasonable mapping to a similar character where they aren’t. Notably the degree symbol (B0h in ISO-8859-2) is implemented.

## Set default display
The default display can be set by the following SysEx:
Host => Launchkey MK3:
```text
Hex:    F0h 00h 20h 29h 02h 0Fh 04h <row> [<character> […]] F7h
```
```text
Dec:    240 0 32 41 2 15 4 <row> [<character> […]] 247
```

Sending this message cancels a temporary display if one is in effect at that time.

The row is padded with spaces (blank characters) to its end if the character sequence is shorter than 16 characters. Excess characters are ignored if it is longer.

Exiting DAW mode clears the default display.

## Clear default display
The default display set above can be cleared by the following SysEx:
Host => Launchkey MK3:
```text
Hex:    F0h 00h 20h 29h 02h 0Fh 06h F7h
```
```text
Dec:    240 0 32 41 2 15 6 247
```

It is recommended to use this message instead of clearing the display by the Set default display message as this message also indicates it to the Launchkey MK3 that the DAW relinquishes the control of the default display.

## Set parameter name
The DAW Pot and Fader modes can receive specific names to display for each control using the following SysEx:
Host => Launchkey MK3:
```text
Hex:    F0h 00h 20h 29h 02h 0Fh 07h <controlindex> [<character> […]] F7h
```
```text
Dec:    240 0 32 41 2 15 7 <controlindex> [<character> […]] 247
```

The <controlindex> parameter is as follows:

-   38h (56) - 3Fh (63): Pots
-   50h (80) - 58h (88): Faders

These names are used when the control is interacted with, showing a temporary display, where they occupy the top row. Sending this SysEx while the temporary display is active has immediate effect (the name can be updated “on the fly”) without extending the duration of the temporary display.

## Set parameter value
The DAW Pot and Fader modes can receive specific parameter values to display for each control using the following SysEx:
Host => Launchkey MK3:
```text
Hex:    F0h 00h 20h 29h 02h 0Fh 08h <controlindex> [<character> […]] F7h
```
```text
Dec:    240 0 32 41 2 15 8 <controlindex> [<character> […]] 247
```

The <controlindex> parameter is as follows:

-   38h (56) - 3Fh (63): Pots
-   50h (80) - 58h (88): Faders

These parameter value strings (they can be arbitrary) are used when the control is interacted with, showing a temporary display, where they occupy the bottom row. Sending this SysEx while the temporary display is active has immediate effect (the value can be updated “on the fly”) without extending the duration of the temporary display.

If this message is not used, a default parameter value display of 0 - 127 is provided by the Launchkey MK3.

# Controlling the Launchkey MK3’s features
Some of the Launchkey MK3’s features can be controlled by MIDI messages. All functionality described in this chapter are accessible through the LKMK3 DAW In / Out (USB) interface only.

## Arpeggiator
The Arpeggiator may be controlled by Control Change events on Channel 1 (Midi status: B0h, 176) on the following indices:

-   6Eh (110): Arpeggiator On (Nonzero value) / Off (Zero value).
-   55h (85): Arp type. Value range: 0 - 6, see below.
-   56h (86): Arp rate. Value range: 0 - 7, see below.
-   57h (87): Arp octave. Value range: 0 - 3, corresponding to octave counts 1 - 4.
-   58h (88): Arp latch On (Nonzero value) / Off (Zero value).
-   59h (89): Arp gate. Value range: 0 - 63h (99), corresponding to lengths 0% - 198%.
-   5Ah (90): Arp swing. Value range: 22h (34) - 5Eh (94), corresponding to swings -47% - 47%.
-   5Bh (91): Arp rhythm. Value range: 0 - 4, see below.
-   5Ch (92): Arp mutate. Value range: 0 - 127.
-   5Dh (93): Arp deviate. Value range: 0 - 127.

Arp type values:

-   0: Up
-   1: Down
-   2: Up/Down
-   3: As Played
-   4: Random
-   5: Chord
-   6: Mutate

Arp rate values:

-   0: 1/4
-   1: 1/4 Triplet
-   2: 1/8
-   3: 1/8 Triplet
-   4: 1/16
-   5: 1/16 Triplet
-   6: 1/32
-   7: 1/32 Triplet

Arp rhythm values:

-   0: Note
-   1: Note - Pause - Note
-   2: Note - Pause - Pause - Note
-   3: Random
-   4: Deviate

## Scale mode
Scale mode may be controlled by Control Change events on Channel 16 (Midi status: BFh, 191) on the following indices:

-   0Eh (14): Scale mode On (Nonzero value) / Off (Zero value).
-   0Fh (15): Scale type. Value range: 0 - 7, see below.
-   10h (16): Scale key (root note). Value range: 0 - 11, transposing upwards by semitones.

Scale type values:

-   0: Minor
-   1: Major
-   2: Dorian
-   3: Mixolydian
-   4: Phrygian
-   5: Harmonic minor
-   6: Minor pentatonic
-   7: Major pentatonic

# Configuration messages

## Velocity curve
This message configures the Velocity curve of the Keys and the Pads, which are normally available in the Settings menu:
Host => Launchkey MK3:
```text
Hex:    F0h 00h 20h 29h 02h 0Fh 02h <target> <curve> F7h
```
```text
Dec:    240 0 32 41 2 15 2 <target> <curve> 247
```

The <target> specifies which part to set the velocity curve for:

-   0: Keys
-   1: Pads

For <curve>, the followings are available:

-   0: Soft (Playing soft notes is easier).
-   1: Medium.
-   2: Hard (Playing hard notes is easier).
-   3: Fixed velocity.

## Startup animation
The Launchkey MK3’s Startup animation can be modified by the following SysEx:
Host => Launchkey MK3:
```text
Hex:    F0h 00h 20h 29h 02h 0Fh 78h <interval> <rgb> [<rgb> […]] F7h
```
```text
Dec:    240 0 32 41 2 15 120 <interval> <rgb> [<rgb> […]] 247
```

The <interval> byte specifies the interval in 2 millisecond units for advancing one pad towards the right and up.

The <rgb> field is a triplet of Red, Green and Blue components (0 - 127 range each), specifying the colour to scroll in on the subsequent step. The animation is smoothly interpolated between the steps. Up to 56 steps may be added, further steps are ignored.

Upon receiving this message, the Launchkey MK3 runs the Startup animation set up (without actually rebooting), so the result can be immediately observed.

The following SysEx message encodes the original Startup animation:
Host => Launchkey MK3:
```text
Hex:    F0h 00h 20h 29h 02h 0Fh 78h 28h
00h 0Fh 05h 00h 1Eh 0Ah 00h 28h 14h 00h 50h 1Eh 00h 64h 32h 00h 7Fh 50h 00h 7Fh 64h 00h 7Fh 7Fh 00h 64h 7Fh 00h 50h 7Fh 00h 3Fh 7Fh 00h 28h 7Fh 00h 13h 7Fh 00h 00h 7Fh 00h 00h 64h 00h 00h 3Fh F7h
```
```text
Dec:    240 0 32 41 2 15 120 40
0 15 5 0 30 10 0 40 20 0 80 30 0 100 50 0 127 80 0 127 100 0 127 127 0 100 127 0 80 127 0 63 127 0 40 127 0 19 127 0 0 127 0 0 100 0 0 63 247
```
