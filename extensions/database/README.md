# database

SQL database client for Atur Terminal — SQLite, Cloudflare D1, MySQL, MariaDB, and PostgreSQL.

## Features

- Connection manager with groups, colors, test connection, and URL import
- Schema browser: databases, schemas, tables, views, columns, indexes, foreign keys, triggers, routines
- Data grid with pagination, sorting, filtering, and inline editing (pending changes reviewed as SQL before applying)
- SQL editor with syntax highlighting, schema-aware autocomplete, multiple query tabs, history, saved queries, and EXPLAIN
- Structure view with DDL, create/drop table and index, truncate
- Export to CSV/JSON/SQL, CSV import, and full database dumps
- SSH tunneling for remote databases

## Requirements

Databases are reached through their command-line clients via `atur.exec`:

- SQLite: `sqlite3` (ships with macOS)
- Cloudflare D1: `wrangler` on your `PATH` (`npm install -g wrangler`), authenticated with `wrangler login` or a `CLOUDFLARE_API_TOKEN` in your environment
- PostgreSQL: `psql` and `pg_dump` (`brew install libpq && brew link --force libpq`)
- MySQL: `mysql` and `mysqldump` (`brew install mysql-client`)
- MariaDB: `mariadb` and `mariadb-dump` (`brew install mariadb`)

## Cloudflare D1

D1 is reached through `wrangler d1 execute --json` (and `wrangler d1 export` for dumps), so it behaves like SQLite: same schema browser, grid, editing, structure view, and `EXPLAIN QUERY PLAN`.

- **Database name or binding** (required): the D1 database name, or a binding name from your wrangler config.
- **Remote (production)** (default on): queries run against the live database in your Cloudflare account. Turn it off to use the local database that `wrangler dev` uses (`--local`).
- **Wrangler config** (optional): path to `wrangler.toml` / `wrangler.jsonc`, passed as `--config`. Needed to resolve binding names and for local databases outside the current project.
- **Local persist directory** (optional, local mode only): passed as `--persist-to`.

Authentication is wrangler's own; the extension stores no Cloudflare credentials. `wrangler` must be installed and on the `PATH` (there is no `npx` fallback).

Limits: every operation spawns a wrangler process, so actions are slower than a local SQLite file; CSV import is not available; SSH tunneling does not apply; "Dump entire database" uses `wrangler d1 export`; multi-statement edits are sent without `BEGIN`/`COMMIT` (D1 rejects them) and run as one D1 batch.

## Security

- Passwords are stored in the macOS Keychain (service `atur-database`), never in extension storage.
- Every database command runs as a plain argument vector (no shell). At connect time the password is written to a private `0600` credential file in a temporary directory (a `passfile` for PostgreSQL, a `--defaults-extra-file` for MySQL/MariaDB), which the CLI reads directly — so the password never appears in a command line or the process list. The file is deleted when you disconnect or close the tab.
- Because commands are argument vectors, Atur Terminal's "Allow & remember" applies per client binary (`psql`, `mysql`, `sqlite3`, `wrangler`, …), so you approve each tool once instead of being prompted per query.
- When the Keychain is unavailable (remote workspaces), passwords are prompted per session and kept only in memory for the credential file.
- SSH tunnels authenticate with your ssh-agent or a key file only; password prompts are disabled (`BatchMode=yes`).

## Remote workspaces

Commands run on the remote host, so the database CLIs must be installed there, file paths are remote paths, and passwords are prompted per session instead of using the Keychain.

## Building

```bash
npm install
npm run build
```

Then use Load Unpacked in Atur Terminal's Extensions modal and Reload after each rebuild.
