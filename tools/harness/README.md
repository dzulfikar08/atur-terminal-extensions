# Harness

Loads a built extension in WebKitGTK (the engine Atur Terminal uses on Linux) behind the same
`atur-ext://<name>/` scheme the app registers (no "secure" or "CORS" flags), with a mock
`window.atur`, and takes a screenshot.

- `harness.py` — one page load: `--root dist --owner name --entry page.html --fixture a.js --out shot.png --wait "<js>"`.
- `mock-base.js` — the mock host. Unknown `atur.*` calls resolve to `null`; fixtures override
  with `__harness.set("files.list", async path => [...])` or edit `__harness.base.storage` etc.
- `fixtures/` — JS injected after the mock. `sample-project.js` is a small in-memory project.
- `cases/<name>.json` — `{ extension, entry, fixtures[], data, wait, width, height, theme, assets{}, eval[], compose{} }`.
  `compose` (`{canvas, mode, bg}`) writes `<name>.listing.png` on a neutral canvas for store listings.
- `run.mjs [case...]` — runs cases under `xvfb-run`, output in `out/`.

Run it in CI: **Actions → Harness → Run workflow** (`cases` = space separated names, empty = all).
The workflow builds the extensions the cases need and uploads `out/` as the `harness` artifact.
Rendering is Mesa software GL; it is the engine, not the app: the app's native chrome is not drawn.
