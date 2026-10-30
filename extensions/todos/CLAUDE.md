# todos

Atur Terminal extension scaffolded from a starter kit. This is an npm + Vite project.

## Layout

- `package.json` — npm manifest. Identity (`name`, `version`) is at the
  top level; all Atur Terminal fields live under the `atur` key. A `build` script
  (Vite) is required.
- `vite.config.js` — builds to `dist/`, the directory Atur Terminal installs.
- `scripts/copy-manifest.mjs` — copies `package.json` into `dist/` after
  the Vite build. Only `dist/` ships, so the manifest must live inside it;
  `build` runs this for you.
- `panel/` + `src/` — your source. The kit ships a working panel, a topbar
  item, and a command; edit them or add your own.

Add a `"background"` script (e.g. `background.js`) under the `atur` key
only if the extension needs to receive pushed workspace events or run
shell commands in the background. Atur Terminal runs it as a long-lived process
that subscribes to events with `atur.events.subscribe` and runs commands
with `atur.exec`. Command, topbar, status bar, tab, and runScript
extensions need no background script.

## Building & editing

Install deps with `npm install`, then `npm run build` to produce
`dist/`. After rebuilding, click "Reload" in the Atur Terminal Extensions modal to
pick up the changes. (`npm run dev` runs Vite's dev server for fast
iteration.)

## Skill

Coding agents in this directory should consult the `atur-extension`
skill in `.claude/skills/` or `.agents/skills/` before generating
manifest or runtime changes.