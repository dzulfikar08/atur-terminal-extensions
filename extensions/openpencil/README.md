# OpenPencil

[OpenPencil](https://openpencil.dev) is an open-source design editor that opens Figma `.fig`
files and Pencil `.pen` files. This extension runs it as a tab in Atur Terminal and opens design
files from your project.

## Use

- **Open a design:** Cmd/Ctrl-click a `.fig` or `.pen` path in a terminal, then pick OpenPencil
  under **Settings → General → Open files with**. Or run **OpenPencil: New Design Tab** from the
  command palette and use **File → Open** (type the path inside the project).
- **Save:** Cmd/Ctrl-S writes back to the same file in the project, local or remote. **Save As**
  asks for a path inside the project. Atur Terminal asks before the first write.
- Changes made to the file outside the editor (git checkout, another tab) are picked up.

## Permissions

| Permission | Why |
| --- | --- |
| `files:read` | Reads the design file you open, as bytes (`.fig` files are binary), and notices changes. |
| `files:write` | Saves the design back to the project (`files.writeBytes`). |

Binary file access (`files.readBytes`, `files.writeBytes`) needs a current Atur Terminal and server.
On an older server `.fig` files are limited to 5 MiB and may not save; `.pen` files are text and
always work, so use **Save As** to a `.pen` file there.

## Offline and private

This build is the editor only:

- OpenPencil's daily ping and usage statistics are **not built in** (the flag that enables them,
  `VITE_OPENPENCIL_FEEDBACK`, is never set; the build fails if it appears in the output).
- OpenPencil Cloud, real-time collaboration, AI chat and agents, web links, and update checks are
  not usable: the page's host script refuses `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`,
  `sendBeacon` and `window.open` to anything outside the extension, and the extension declares no
  network permission.
- Recent files, preferences, and unsaved-work recovery are kept in the tab's local browser storage.

## How it is built

`npm run build` (`scripts/build.mjs`):

1. fetches **exactly** the commit in `upstream.json` from `open-pencil/open-pencil` (a moving tag is
   never trusted; the build fails if the fetched commit differs),
2. applies the small patch in `patches/` (expose the editor's open-file function to the
   host script; drop the hosted app's service worker and demo-document generation, which cannot
   run inside an extension),
3. `bun install --frozen-lockfile`, builds the workspace packages and runs `vite build`,
4. copies the app into `dist/`, loads `src/atur-host.js` before it, and adds
   `LICENSE-OpenPencil`, `THIRD_PARTY_NOTICES.txt` (every bundled dependency and its licence) and
   `UPSTREAM.txt`.

Bun (the version in `upstream.json`) and Node 22.18 or newer are needed. To update OpenPencil, change
`upstream.json`, rebuild, check the patches still apply, and bump the version.

`src/atur-host.js` is the only code of ours that runs in the page. It implements the browser
file APIs OpenPencil already uses (`showOpenFilePicker`, `showSaveFilePicker`,
`FileSystemFileHandle`) on top of `atur.files`, opens the file the tab was started with, and
installs the network guard above.

## Verified

The screenshot in the store listing is a capture of the WebKitGTK harness run (a `.fig` file opened through the host script). The "fonts unavailable" banner appears because font downloads are blocked by the network guard; bundled fonts are used.

CI loads the built extension in WebKitGTK (the engine Atur Terminal uses on Linux) behind the same
`atur-ext://` scheme as the app, opens a `.fig` file produced by OpenPencil's own CLI through a
mock `atur.files`, and uploads a screenshot (Actions → Harness). The repo's harness README lists
what that does and does not cover. The same case also runs in a macOS WKWebView harness (WebGL 2 available, file opened, no errors); neither harness draws Atur Terminal's own window chrome.

## Licence

This extension is MIT licensed with the rest of this repository. OpenPencil is
Copyright (c) 2026 Danila Poyarkov and OpenPencil contributors, MIT licensed: see
`LICENSE-OpenPencil`. Third-party packages bundled into the app keep their own licences, listed in
`dist/THIRD_PARTY_NOTICES.txt`.
