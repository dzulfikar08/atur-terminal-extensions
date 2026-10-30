# Atur

Atur inside Atur Terminal: your issues, inbox and today, the agents waiting on you, and the
Atur issue linked to the terminal you are looking at — without leaving the terminal.

## What it does

- **Sidebar panel and tab view** — *Mine* (issues assigned to you), *Inbox* (notifications),
  *Today* (overdue, due today, needs you, need review, in progress), and *Agents* (agent
  sessions that are **Needs you** or **Done**).
- **Active terminal** — the issue linked to the focused terminal's agent session, shown above
  the lists.
- **Actions** — open an issue, change its state, comment, **Claim** (assign to you, leave the
  `Picked up by … (pane …)` comment Atur links terminals with, move to In Progress), and **Need
  Review** with evidence: a summary plus terminal output (paste the focused terminal's screen
  or edit it first), posted as a comment before the state changes.
- **Workspace switcher** with workspace logos; the choice is remembered.
- Follows the host's `--atur-*` theme, so it matches the Atur gray theme in light and dark.

## Signing in

*Sign in with Atur* runs the browser flow from Atur's MCP authorization docs (OAuth 2.1,
authorization code + PKCE, public client, dynamic registration). It opens `app.diatur.com` in
an Atur Terminal browser tab, reads the redirect address from that tab (or accept the address
pasted into the view), exchanges the code, and closes the tab. *Use an API key instead* accepts
a `pk_live_…` key.

OAuth access tokens are valid only on `https://app.diatur.com/mcp`, so every request is an MCP
tool call. Access tokens last an hour and are refreshed automatically; refresh tokens rotate, so
panes coordinate through storage to spend each one only once.

### Where the credentials live

They are kept in the extension's own `atur.storage` (a JSON file in the app's data folder, per
extension). That store is **not encrypted** and is kept after uninstall, so the extension keeps
only what it needs (one access token and one refresh token, or the API key you typed), never
logs them, and **Sign out** revokes the grant on the server and deletes the stored values. Prefer
the browser sign-in: its tokens expire, unlike an API key.

## Permissions

| Permission | Why |
| --- | --- |
| `storage:read`, `storage:write` | Sign-in state and the workspace choice. |
| `panes:read` | Find the focused terminal (title, folder) and read its screen for evidence. Atur Terminal asks before the first read. |
| `agents:read` | Refresh when an agent's status changes (`agent.status`). |
| `tabs:write` | Open the Atur tab view from the sidebar. |
| `panels:write` | Toggle the sidebar from the top bar and palette. |
| `browser:read`, `browser:write` | Sign in: open the authorization page in an in-app browser tab, read its address once it redirects, then close the tab. Also opens issue links. |
| `notifications:write` | Toasts after an action succeeds. |

Network: only `https://app.diatur.com` (Atur Terminal asks once per host). No program is run.

## Development

```bash
npm install
npm test        # node --test: PKCE, OAuth, token refresh races, MCP client, API flows, sanitizer
npm run build
```

Source is plain ES modules under `src/` (`lib/` is DOM-free and unit-tested; `app.js` renders the
UI; `host.js` is the only file touching `window.atur`). Atur Terminal pages load from a
non-secure scheme, so PKCE uses its own SHA-256 instead of `crypto.subtle`.
