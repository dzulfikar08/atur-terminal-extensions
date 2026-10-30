# Publishing an extension

This repo is the publishing pipeline for the Atur Terminal extension store
(<https://extensions.diatur.com>). Anyone can publish an extension by pull request:
CI validates, builds, and security-scans it; a maintainer reviews it; when the PR is
merged to `main`, CI signs the package and publishes it to the store, where Atur
Terminal's **Settings → Extensions** lists it.

```
fork → add extensions/<name>/ → npm run validate → open PR → CI + review → merge → signed + published
```

> **Looking for the author guide?** How to *build* an extension — every manifest field,
> the `window.atur` API, permissions, and theming — lives in the Atur Terminal app repo under
> [`docs/extensions`](https://github.com/dzulfikar08/atur-terminal/tree/main/docs/extensions)
> (start with [`get-started.md`](https://github.com/dzulfikar08/atur-terminal/blob/main/docs/extensions/get-started.md)).
> The manifest schema CI enforces is [`schema/manifest.schema.json`](schema/manifest.schema.json).

## 1. Fork and scaffold

Fork this repo, then create your extension under `extensions/`. The directory
name **must** equal the package `name` (lowercase letters, digits, dash, dot; no
leading dot).

> **Don't full-clone.** This repo holds every published extension and grows
> large over time. Use a partial + sparse checkout so you only download your own
> extension and the tooling:
>
> ```bash
> git clone --filter=blob:none --sparse https://github.com/<you>/atur-terminal-extensions
> cd atur-terminal-extensions
> git sparse-checkout set extensions/my-extension scripts shared schema
> ```

Copy a small existing extension (for example [`extensions/file-tree`](extensions/file-tree)
or [`extensions/todos`](extensions/todos)) into `extensions/my-extension/` and set `name`
in its `package.json` to `my-extension`.

The manifest lives under the `"atur-terminal"` key of `package.json`. Keep the `"$schema"`
line at the top of that block — it gives editors autocomplete and inline validation against
this repo's schema. Atur Terminal ignores it.

## 2. Build it

Follow the [author guide](https://github.com/dzulfikar08/atur-terminal/tree/main/docs/extensions)
in the Atur Terminal app repo. CI here enforces the same rules the app does. Your
`package.json` needs a `build` script that produces `dist/` (including a copy of
`package.json`) and a committed `package-lock.json`; dependencies are installed with
`npm ci --ignore-scripts`.

### Shared UI (`shared/ui`)

This repo ships a small, framework-free UI package —
[`shared/ui`](shared/ui/README.md) — with the documented sizing scale as CSS
tokens, native-looking primitives built on the official `--atur-*` theme
variables, and a few DOM helpers. Using it is the fastest way to look native
and is recommended for new extensions: add the Vite path alias from its README
and import `@atur/ui/ui.css`. It is consumed as source and bundled into your
`dist/` at build time — nothing changes about packaging or review. It is
entirely optional; compose your own CSS alongside it, override its tokens, or
skip it.

### Rules CI enforces

- `package.json` matches the [manifest schema](schema/manifest.schema.json).
- Directory name equals the package `name`.
- Every referenced file (`background`, tab/panel/popover `entry`, command
  `script`, SVG icons) exists and stays inside your directory.
- Commands reference real `tabTypes` / `panels` / `popovers`; topbar and status
  bar items reference real commands.
- IDs and setting keys are unique.
- A `README.md` is present.
- A **`marketplace` block** is present with a **listing icon** and **at least one
  screenshot** (see §4) — both are required for the store listing.

### Advisory checks (surfaced to reviewers)

Use of `commands:exec`, network calls (`fetch`, `WebSocket`, …), `eval`, and
minified/obfuscated code are flagged for human review. Ship **readable source**
and declare only the permissions you actually use.

## 3. Validate locally

```bash
npm install
node scripts/validate.mjs my-extension     # one extension
node scripts/validate.mjs                   # all extensions
node scripts/pack.mjs --dry-run my-extension  # prove it zips + see its hash
```

Validation uses the manifest schema vendored in `schema/manifest.schema.json`; the build
step needs network access to install your dependencies.

## 4. Listing metadata, icon, and screenshots (required)

Every extension must carry a `marketplace` block in `package.json` (under `"atur-terminal"`) with a
**listing icon** and **at least one screenshot**. CI rejects PRs without them.

```json
"marketplace": {
  "author": "Your Name",
  "github": "your-handle",
  "homepage": "https://example.com",
  "repository": "https://github.com/you/your-ext",
  "categories": ["git", "productivity"],
  "icon": "icon.svg",
  "screenshots": ["screenshots/screenshot-1.png", "screenshots/screenshot-2.png"]
}
```

This block is used only for the marketplace listing; the app loader ignores it.

### Icon — required

- **SVG (preferred)**, or a **square PNG at least 256×256**.
- Size limits: SVG ≤ 512 KB, PNG ≤ 1 MB.

### Screenshots — at least one required

- **PNG, 16:10 or 16:9 aspect ratio**.
- 1 to 6 screenshots, each ≤ 3 MB.

The icon and screenshots are uploaded to the marketplace alongside your signed
extension, each with its own SHA-256.

## 5. Write a good README

Each extension also needs a `README.md` with:

- A one or two sentence description.
- The permissions it uses and why.
- (Optional) an embedded screenshot/GIF for readers browsing the repo.

## 6. Open a pull request

Push your branch and open a PR against `main`. **One extension per PR**, and the PR
title is `extension-name 1.0.1` (the name and the version you are publishing). Fill in
the PR template. Then:

1. **CI runs** with a read-only token and no secrets: tooling tests, a build of the
   extensions you touched, validation against the manifest schema, and a deterministic
   dry-run pack. A bot comment lists advisory security findings (`commands:exec`,
   network access, `eval`, minified code, …) for the reviewer. Changing `shared/`,
   `scripts/`, or the workflows rebuilds every extension.
2. **A maintainer reviews** the source for safety, least-privilege permissions, and quality.
   Expect questions about every permission you declare. The version in your PR must be
   higher than the one already published.
3. **On merge to `main`**, the publish workflow builds the changed extensions again,
   packs each into a zip, **signs it with the store's Ed25519 key**, and uploads it with
   its signed metadata to <https://extensions.diatur.com>. You never handle keys or
   tokens, and PRs from forks can never read them.
4. The extension appears in **Settings → Extensions** and at
   `https://extensions.diatur.com/e/<name>`. Installed copies update when the user next
   checks.

The first publisher of a name owns it: later versions must come from this repo, and a
name cannot be taken over by another extension.

## Versioning

Published versions are **immutable**. To change an extension after it is merged,
bump `version` — the previous version's bytes and hash never change, so
already-installed users are never surprised.

## Updating an existing extension

Open a PR that bumps `version` and changes the files. The same review and
publish flow applies.

## Removing an extension

Open a PR deleting the `extensions/<name>/` directory, or file a
[report](.github/ISSUE_TEMPLATE/1-extension-issue.yml) if it is not yours and
should be taken down.

## For maintainers: publishing setup

- Repository secrets: `EXTENSIONS_SIGNING_KEY` (base64 PKCS#8 Ed25519 private key) and
  `EXTENSIONS_PUBLISH_TOKEN` (the store Worker's bearer token). The public key is
  committed as `signing.pub` and baked into the Atur Terminal app.
- `first-party.json` lists the extensions this project maintains; the store marks them
  as first-party. Changing it needs maintainer review.
- `held.json` lists imported community extensions that are kept in the repo but not published
  yet (their listing images are still being replaced). Remove a name to release it.
- To publish (or re-publish) without a code change, run the **Publish** workflow manually
  with a list of names, or `first-party`. Versions the store already has are skipped.
- Generate a new key pair with
  `node --input-type=module -e "import('./scripts/lib/sign.mjs').then(m=>console.log(m.generateKeyPair()))"`
  (`generateKeyPair()`), and follow the rotation notes in [SECURITY.md](SECURITY.md).
