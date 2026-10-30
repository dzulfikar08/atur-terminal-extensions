# Security Policy

## Reporting a vulnerability in the tooling

For a vulnerability in this repo's validation, packaging, signing, or CI — or in
how the Atur Terminal app verifies and installs extensions — **do not open a public
issue.** Use [GitHub's private vulnerability reporting](https://github.com/dzulfikar08/atur-terminal/security/advisories/new).

Expect acknowledgment within 48 hours and a fix plan within 7 days for confirmed
issues.

## Reporting a malicious or abusive extension

If a **listed extension** behaves maliciously (data exfiltration, unexpected
shell or network use, etc.) or violates policy, file a
[report](.github/ISSUE_TEMPLATE/1-extension-issue.yml). Maintainers triage these
with priority and can unlist the extension by removing its directory, which
drops it from the next published index.

## How integrity is guaranteed

Each extension is signed individually at publish time. **Two** signatures are
produced: one over the extension zip, and one over a metadata document that
binds `name`, `version`, the zip's SHA-256, the declared `permissions`, and a
SHA-256 for each listing asset (icon, screenshots). The desktop app enforces
this trust chain, in order:

1. **Pinned key.** The app bundles Atur Terminal's Ed25519 public key (`signing.pub`, 32 raw bytes in base64).
2. **Verify the signed metadata.** Download the metadata document and its
   signature; verify against the pinned key. Reject on failure. **All trusted
   facts are taken from this signed document** — never from unauthenticated API
   fields or headers.
3. **Verify the zip signature** against the pinned key, and require the zip's
   SHA-256 to equal the one in the signed metadata.
4. **Match what was requested.** Require the signed `name`/`version` to equal
   what the app asked to install (rejects downgrade/rollback and cross-listing
   substitution).
5. **Verify listing assets** (icon/screenshots) against the SHA-256s in the
   signed metadata before displaying them.
6. **Consent from signed facts.** Show the user the `permissions` from the signed
   metadata, and cross-check them against the unpacked manifest before installing.
7. **Re-validation.** Unpack to a temporary directory, run the same manifest
   validation as the loader, then install into
   `~/.config/atur-terminal/extensions/<name>/`.

Because both the bytes **and** the facts the user consents to (version,
permissions, asset hashes) are covered by a signature from a key that never
leaves CI, a compromised host or transport cannot substitute bytes, misrepresent
permissions, or roll a user back to an older signed version.

### Signing key

The Ed25519 secret key exists only as a GitHub Actions secret
(`EXTENSIONS_SIGNING_KEY`, base64 PKCS#8) used by the publish workflow, plus an
owner-only backup outside this repository. It is unencrypted, so its protection is
the Actions secret store alone. The matching public key is committed as
`signing.pub` and pinned in the app. The upload to extensions.diatur.com is
authenticated with a separate Bearer token, also a GitHub Actions secret
(`EXTENSIONS_PUBLISH_TOKEN`). Signatures are plain detached Ed25519 over the exact
uploaded bytes, base64-encoded; the publish script refuses to upload if the
signature does not verify against `signing.pub`.

Required safeguards (the key is the entire root of trust):

- **Protected branch.** Publish runs only on `main`, from the trusted workflow
  file. Workflows triggered by pull requests never receive the secrets.
- **No untrusted interpolation.** The publish workflow never expands
  attacker-controlled values into shell (extension names are passed via env and
  matched against a strict allowlist).
- **Rotation.** Rotate on a schedule and immediately on any suspicion of
  exposure. The app pins more than one public key: add the new key to the pin
  set, sign with both for a transition window, then retire the old key.

### Compromise, revocation, and exposure window

If `EXTENSIONS_SIGNING_KEY` leaks, an attacker can sign malicious zips that pass the
pinned-key check until users update the app — **the maximum exposure window is
the app's update cadence.** The store cannot revoke the key (it is untrusted in
the threat model). To shrink and detect this:

- **Kill-switch / forced update**, distinct from planned rotation, to push a new
  pinned-key set quickly.
- A **transparency log** (an append-only, signed record of everything ever
  signed) and a **signed revocation list** the app fetches and checks are the
  planned hardening to make a compromise detectable and recoverable without an
  app update. Until then, the exposure window is bounded only by update cadence —
  documented here intentionally.

## What review covers

Every extension PR is reviewed by a maintainer before merge. CI flags
`commands:exec`, a `runScript` command missing `commands:run-script`, network
access, `eval`/`Function`, and minified/obfuscated code for that review.
Extensions run arbitrary JavaScript inside Atur Terminal, so review and least privilege
are the primary defenses — declare only the permissions you use, and ship
readable source.

**SVG listing icons can contain scripts** (`<script>`, `foreignObject`, event
handlers). Wherever an icon is rendered untrusted (the marketplace UI), it must
be rasterized or script-stripped, or served behind a CSP that blocks execution —
do not inline raw author SVG into a privileged context.
