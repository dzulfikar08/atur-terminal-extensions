# Atur Terminal Extensions

The extensions repository and publishing pipeline for
[Atur Terminal](https://github.com/dzulfikar08/atur-terminal). Everything under
`extensions/` is built, signed, and published to the Atur Terminal extension store at
<https://extensions.diatur.com>, where Atur Terminal's **Settings → Extensions** installs
and updates it.

## First-party extensions

Maintained here and published first:

| Extension | What it does |
| --- | --- |
| [`files`](extensions/files) | Code editor and file preview tabs. |
| [`file-tree`](extensions/file-tree) | A file tree panel for the active worktree. |
| [`git`](extensions/git) | Git changes, history, and branches for the current project. |
| [`git-workspace`](extensions/git-workspace) | Git workspace views across worktrees. |
| [`github`](extensions/github) | GitHub pull requests and checks. |
| [`database`](extensions/database) | Database browser and query editor (SQLite, PostgreSQL, MySQL, MariaDB; Cloudflare D1 through `wrangler`). |
| [`openpencil`](extensions/openpencil) | OpenPencil design editor for `.fig` and `.pen` files. |

The other directories in [`extensions/`](extensions) are community extensions that are
also published from this repo.

## Build your own

- [Contributing and publishing by pull request](CONTRIBUTING.md)
- [Extension author guide](https://github.com/dzulfikar08/atur-terminal/tree/main/docs/extensions)
- [Manifest schema](schema/manifest.schema.json)
- [Security model](SECURITY.md)

## Licence

MIT. See [LICENSE](LICENSE). This repository started from the MIT-licensed
[muxy-app/extensions](https://github.com/muxy-app/extensions); its copyright notice is kept
in LICENSE. Bundled third-party software keeps its own licence (see each extension's
README, for example OpenPencil's MIT licence in `extensions/openpencil`).
