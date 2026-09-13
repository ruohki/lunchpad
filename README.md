![Lunchpad Logo](.github/logo.png)

[![Discord Shield](https://discordapp.com/api/guilds/658127965183541255/widget.png?style=shield)](https://discord.com/invite/4Ys9TRR)
<a href="https://ko-fi.com/X8X71UNDO"><img src="https://cdn.prod.website-files.com/5c14e387dab576fe667689cf/670f5a02fcf48af59c591185_support_me_on_kofi_dark.avif" alt="Support me on Ko-fi" height="36"></a>

## What is this?

Lunchpad is a macro application that makes use of Novation™ Launchpads. However you do not need one to use it.

Every pad on the Launchpad becomes a button with a look, a colour and two lists of actions: one for the press, one for the release. Pages hold as many layouts as you like and the active page is painted onto the device. Lunchpad 1.0 is a rewrite of the original Electron app: a Rust core drives the hardware, plays audio, presses keys and talks to your streaming software, and the macro engine keeps running while the window is hidden.

### Supported Launchpads

- Launchpad Mini (MK1, MK2 and MK3)
- Launchpad S
- Launchpad MK2
- Launchpad X
- Launchpad Pro MK2
- Launchpad Pro MK3
- Launchkey Mini MK3 (pads, scene buttons, Play and Record, and the eight knobs as faders; the touch strips are not read yet)

Lunchpad asks every MIDI device to identify itself, so the right Launchpad is found and remembered no matter what the operating system calls its ports. Velocity-sensitive models can feed the press force into macros, for example as the volume of a sound. On a Launchpad Pro that force comes from the pad's own set-up screen (hold Setup): if its velocity option is Off, every press counts as full force.

### Actions

- Play a sound on a chosen output device, trimmed with a waveform editor, with the volume optionally following the press velocity
- Text to speech with the system voices
- Hotkey sequences: press, hold and release keys, type text
- Launch applications and scripts, optionally capturing their output
- HTTP requests with any method, headers, body, file uploads and login; the response can become a file (from the body, a base64 field or a linked URL) that is reused while the request is unchanged, so speech from a text-to-speech service is fetched once and then played by the sound action
- Variables, conditions and small JavaScript snippets to glue actions together
- Delay, switch page, set the colour of any button, run another button's actions
- Flip flop (alternate between two sets of actions), push-to-talk sections, loop while held
- Stop this macro, restart it, or stop everything
- Faders: turn a row or column of pads into one control that blends between two colours, and feed its level into any action, for example OBS, Streamlabs or system volume

### OBS Studio and Streamlabs Desktop

Both integrations offer the same controls: switch scenes (also across scene collections), show or hide sources, mute and set the volume of audio sources, toggle filters, start, stop or toggle streaming, recording and the replay buffer, and save the replay buffer after a cool play. Streamlabs adds studio mode and the transition button.

OBS Studio needs its built-in WebSocket server (Tools → WebSocket Server Settings) switched on. Streamlabs Desktop needs nothing: Lunchpad talks to its local API while it runs.

### Home Assistant

Pads can turn any entity on, off or toggle it, set a brightness, colour temperature, cover position, fan speed, volume, number or target temperature, fixed or from a fader, and call any service with JSON data. The editors complete entity ids and names from your instance. Enter the address and a long-lived access token in Settings → Home Assistant; the token, like the OBS password and the Streamlabs token, is kept in the system's credential store rather than in the settings file.

### Tray and updates

Lunchpad lives in the tray with the same menu as before: show the window, stay on top, minimize to tray, run at startup, stop all running macros. Installed copies check the GitHub releases of this repository and offer new versions inside the app.

## Download

Builds for macOS (Apple Silicon and Intel) and Windows are on the [releases page](https://github.com/ruohki/lunchpad/releases).

## Development

Lunchpad is built with [Tauri](https://tauri.app) (Rust) and React. You need [Bun](https://bun.sh), a Rust toolchain and the platform prerequisites from the Tauri guide.

```bash
bun install
bun run tauri dev                              # the app with hot reload
bun run build                                  # type check and interface build
cargo test --manifest-path src-tauri/Cargo.toml
```

Settings and pages are stored in the platform config directory (`~/Library/Application Support/com.lunchpad.app` on macOS, `%APPDATA%\com.lunchpad.app` on Windows). Novation's programmer reference manuals are in `docs/novation/`, hardware test tools in `src-tauri/examples/`.

### Documentation

The user documentation lives at [docs.lunchp.ad](https://docs.lunchp.ad). It is an Astro Starlight site ([ruohki/lunchpad-docs](https://github.com/ruohki/lunchpad-docs), checked out as `lunchpad-extra/docs` next to this checkout). It explains every action on its own page with a screenshot of its editor, and it reads this repository to stay current: action names, descriptions, icons and menu groups come from `src/i18n/en.json`, `src/lib/api.ts` and `src/components/actions/`, and the screenshots are taken from this interface running in a browser against a fake backend.

When a change alters what users see, update the docs in the same release:

- **A new action**: follow [docs/ADDING_ACTIONS.md](docs/ADDING_ACTIONS.md). The docs' `npm run actions:check` fails until the action has a page and a screenshot.
- **A changed editor or settings tab**: run `npm run screenshots` in the docs folder and review the changed images.
- **New or changed behaviour**: update the matching guide or action page. Pages name the app's labels exactly as `src/i18n/en.json` has them.

### Releases

Set the same version in `package.json`, `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json`, then push a tag `vX.Y.Z`. The release workflow builds every platform, signs the updater artifacts and publishes a draft release with the update manifest. Publishing the draft makes installed copies offer the update. The workflow expects the `TAURI_SIGNING_PRIVATE_KEY` secret and, for a notarized macOS build, the Apple secrets listed at the top of `.github/workflows/release.yml`.

---

If you need any assistance feel free to join the Discord: [https://discord.gg/4Ys9TRR](https://discord.gg/4Ys9TRR)

---

Licence GPL-3.0 - Tillmann Hübner (@ruohki)

Lunchpad is free software under the GNU General Public License v3: use it, change it and pass it on, but keep the licence, the credits and the source with it. The Novation manuals in `docs/novation` are Novation's own documents and are not covered by this licence.
