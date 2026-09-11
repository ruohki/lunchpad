# Adding an action

An action touches the Rust model and engine, the interface, the translations, and the
documentation site. The compiler catches most of the app side; the docs have a check of their
own. Work through both lists before a release that ships the action.

## In the app

1. **Model**: add a variant to `ActionKind` in `src-tauri/src/macros/model.rs`. Give new
   fields `#[serde(default)]` (or a default function) so profiles written by older versions
   still load, and extend the JSON shape tests at the bottom of the file.
2. **Engine**: handle the variant in `execute` in `src-tauri/src/macros/engine.rs`. Actions
   that only change Lunchpad's own state live there; actions that talk to the outside world
   (sound, keys, processes, OBS, Streamlabs, HTTP) go to `execute_external` in
   `src-tauri/src/macros/exec.rs`. Expand text fields with `ctx.expand(...)` if they should
   take `{{placeholders}}`, and stop promptly when `ctx.token` is cancelled.
3. **Types**: mirror the variant in the `ActionKind` union in `src/lib/api.ts` and add the type
   to `AVAILABLE_ACTIONS`.
4. **Behaviour in the list**, `src/components/actions/actionUtils.ts`: an icon in
   `ACTION_ICONS`, the defaults in `createActions`, a one-line `summarize`, `hasWait` if the
   action takes time, and `knownVariables` if it writes a variable.
5. **Menu**: add the type to a group in `MENU_GROUPS` in
   `src/components/actions/ActionsTab.tsx`. Actions without settings go into `NO_BODY`.
6. **Editor**: a `case` in `src/components/actions/ActionEditors.tsx`, or its own
   `*Editor.tsx` next to it.
7. **Strings**: `actions.types.<type>.name` and `.desc` in `src/i18n/en.json`, plus the
   labels the editor uses. The docs read the name and description from here.
8. **Legacy import**: if the old Electron app had an equivalent, map it in
   `src-tauri/src/profile/legacy.rs`.

## In the documentation

The documentation site (Astro Starlight) lives in `lunchpad-extra/docs`, next to this
checkout. It reads this repository to stay in step: action names, descriptions, icons and menu
groups come straight from the files above, and its screenshots are taken from the real
interface running against a fake backend. The full guide is `CONTRIBUTING.md` in the docs
project. In short, from the docs folder:

1. `npm run actions:sync` pulls the new action's name, description, icon and group from this
   checkout (set `LUNCHPAD_DIR` if it is not at `../../lunchpad`).
2. Add one line for the action to `scripts/screenshots/scenarios/actions.ts`. If its editor
   calls a backend command the fake backend does not know yet, answer it in
   `scripts/screenshots/mock/backend.ts` (the browser console warns about unhandled
   commands).
3. `npm run screenshots -- <type>` captures `src/assets/screenshots/actions/<type>.png`.
4. Write `src/content/docs/actions/<group>/<name>.mdx` from the template in `CONTRIBUTING.md`,
   with `actionTypes: [<type>]` in the frontmatter. Mark it with a sidebar badge ("New")
   for the release that introduces it.
5. `npm run actions:check` must pass: it fails while an action of the app has no page or no
   screenshot, or a page names an action the app no longer has. Then `npm run build`.

Renaming an action type is a breaking change for saved profiles; if it ever happens, update
`actionTypes` in the docs page and rename the screenshot along with it.
