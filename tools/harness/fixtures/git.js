// Sample repository for the git extension: acme-web on branch feature/login.
(() => {
  const h = window.__harness;
  const hoursAgo = (n) => new Date(Date.now() - n * 3600 * 1000).toISOString();
  const ROOT = "/home/dev/acme-web";
  const PATCH = "diff --git a/src/auth/github.ts b/src/auth/github.ts\nnew file mode 100644\nindex 0000000..7195821\n--- /dev/null\n+++ b/src/auth/github.ts\n@@ -0,0 +1,39 @@\n+import { createSession, type Session } from \"./session\";\n+\n+const AUTHORIZE_URL = \"https://github.com/login/oauth/authorize\";\n+const TOKEN_URL = \"https://github.com/login/oauth/access_token\";\n+const USER_URL = \"https://api.github.com/user\";\n+\n+export function authorizeUrl(state: string): string {\n+  const params = new URLSearchParams({\n+    client_id: process.env.GITHUB_CLIENT_ID ?? \"\",\n+    scope: \"read:user user:email\",\n+    state,\n+  });\n+  return `${AUTHORIZE_URL}?${params}`;\n+}\n+\n+async function exchangeCode(code: string): Promise<string> {\n+  const response = await fetch(TOKEN_URL, {\n+    method: \"POST\",\n+    headers: { Accept: \"application/json\", \"Content-Type\": \"application/json\" },\n+    body: JSON.stringify({\n+      client_id: process.env.GITHUB_CLIENT_ID,\n+      client_secret: process.env.GITHUB_CLIENT_SECRET,\n+      code,\n+    }),\n+  });\n+  if (!response.ok) {\n+    throw new Error(`Token exchange failed: ${response.status}`);\n+  }\n+  const { access_token: token } = await response.json();\n+  return token;\n+}\n+\n+export async function handleCallback(code: string): Promise<Session> {\n+  const token = await exchangeCode(code);\n+  const user = await fetch(USER_URL, {\n+    headers: { Authorization: `Bearer ${token}` },\n+  }).then((res) => res.json());\n+  return createSession(String(user.id));\n+}\ndiff --git a/src/auth/session.ts b/src/auth/session.ts\nindex a72596c..fd184a8 100644\n--- a/src/auth/session.ts\n+++ b/src/auth/session.ts\n@@ -3,16 +3,18 @@ import { randomBytes } from \"node:crypto\";\n export interface Session {\n   id: string;\n   userId: string;\n+  provider: \"password\" | \"github\";\n   expiresAt: number;\n }\n \n const SESSION_TTL_MS = 1000 * 60 * 60 * 24;\n const sessions = new Map<string, Session>();\n \n-export function createSession(userId: string): Session {\n-  const session = {\n+export function createSession(userId: string, provider: Session[\"provider\"] = \"github\"): Session {\n+  const session: Session = {\n     id: randomBytes(16).toString(\"hex\"),\n     userId,\n+    provider,\n     expiresAt: Date.now() + SESSION_TTL_MS,\n   };\n   sessions.set(session.id, session);\ndiff --git a/src/pages/Login.tsx b/src/pages/Login.tsx\nindex 8c511a5..b6c4b17 100644\n--- a/src/pages/Login.tsx\n+++ b/src/pages/Login.tsx\n@@ -1,13 +1,19 @@\n import { useState } from \"react\";\n import { login } from \"../auth/password\";\n+import { GitHubIcon } from \"../components/icons\";\n \n export function LoginPage() {\n   const [email, setEmail] = useState(\"\");\n   const [password, setPassword] = useState(\"\");\n+  const [error, setError] = useState<string | null>(null);\n \n   async function onSubmit(event: React.FormEvent) {\n     event.preventDefault();\n-    await login(email, password);\n+    try {\n+      await login(email, password);\n+    } catch {\n+      setError(\"Invalid email or password\");\n+    }\n   }\n \n   return (\n@@ -20,8 +26,12 @@ export function LoginPage() {\n           value={password}\n           onChange={(e) => setPassword(e.target.value)}\n         />\n+        {error && <p role=\"alert\">{error}</p>}\n         <button type=\"submit\">Sign in</button>\n       </form>\n+      <a className=\"provider-button\" href=\"/auth/github\">\n+        <GitHubIcon /> Sign in with GitHub\n+      </a>\n     </main>\n   );\n }\ndiff --git a/src/routes/index.ts b/src/routes/index.ts\nindex 08ed154..ae74c3e 100644\n--- a/src/routes/index.ts\n+++ b/src/routes/index.ts\n@@ -1,8 +1,10 @@\n import { Router } from \"express\";\n+import { auth } from \"./auth\";\n import { dashboard } from \"./dashboard\";\n import { settings } from \"./settings\";\n \n export const routes = Router();\n \n+routes.use(\"/auth\", auth);\n routes.use(\"/dashboard\", dashboard);\n routes.use(\"/settings\", settings);\ndiff --git a/tests/auth/callback.test.ts b/tests/auth/callback.test.ts\nnew file mode 100644\nindex 0000000..3ab00ac\n--- /dev/null\n+++ b/tests/auth/callback.test.ts\n@@ -0,0 +1,22 @@\n+import { describe, expect, it, vi } from \"vitest\";\n+import { handleCallback } from \"../../src/auth/github\";\n+\n+describe(\"handleCallback\", () => {\n+  it(\"creates a github session after exchanging the code\", async () => {\n+    vi.stubGlobal(\n+      \"fetch\",\n+      vi\n+        .fn()\n+        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: \"tok\" }) })\n+        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 42 }) }),\n+    );\n+    const session = await handleCallback(\"abc123\");\n+    expect(session.userId).toBe(\"42\");\n+    expect(session.provider).toBe(\"github\");\n+  });\n+\n+  it(\"rejects when the token exchange fails\", async () => {\n+    vi.stubGlobal(\"fetch\", vi.fn().mockResolvedValueOnce({ ok: false, status: 401 }));\n+    await expect(handleCallback(\"bad\")).rejects.toThrow(\"Token exchange failed: 401\");\n+  });\n+});\n";

  const files = {
    staged: [
      { path: "src/auth/github.ts", status: "A", additions: 39, deletions: 0 },
      { path: "src/auth/session.ts", status: "M", additions: 4, deletions: 2 },
    ],
    unstaged: [
      { path: "src/pages/Login.tsx", status: "M", additions: 11, deletions: 1 },
      { path: "src/routes/index.ts", status: "M", additions: 2, deletions: 0 },
      { path: "tests/auth/callback.test.ts", status: "?", additions: 22, deletions: 0 },
    ],
  };

  const ref = (name, kind) => ({ name, kind });
  const commit = (hash, subject, parents, hours, author, refs = []) => ({
    hash: hash.padEnd(40, "0"), shortHash: hash.slice(0, 7), subject, authorName: author,
    authorDate: hoursAgo(hours), isMerge: parents.length > 1,
    parentHashes: parents.map((p) => p.padEnd(40, "0")), refs,
  });
  const log = [
    commit("a1f09c3", "Add tests for the GitHub OAuth callback", ["b72e4d8"], 1, "Maya Chen", [ref("HEAD -> feature/login", "localBranch"), ref("origin/feature/login", "remoteBranch")]),
    commit("b72e4d8", "Add \"Sign in with GitHub\" button to the login page", ["c9d1a05"], 3, "Maya Chen"),
    commit("c9d1a05", "Merge branch 'main' into feature/login", ["d40b7e2", "e5a3c91"], 5, "Maya Chen"),
    commit("d40b7e2", "Issue a session cookie after the token exchange", ["f18c2b6"], 7, "Maya Chen"),
    commit("e5a3c91", "Fix flaky checkout test on slow CI runners (#127)", ["a903d5f"], 8, "Leo Park", [ref("origin/main", "remoteBranch"), ref("main", "localBranch")]),
    commit("f18c2b6", "Add GitHub OAuth redirect and callback routes", ["b4e7a10"], 26, "Maya Chen"),
    commit("a903d5f", "Upgrade to Node 22 and refresh lockfile (#125)", ["b4e7a10"], 28, "Sam Ortiz"),
    commit("b4e7a10", "Release v2.4.0", ["c61f8d3"], 50, "Priya Nair", [ref("v2.4.0", "tag")]),
    commit("c61f8d3", "Merge pull request #121 from priya-nair/docs-env-vars", ["d7a25e4", "e0b9c18"], 52, "Priya Nair"),
    commit("d7a25e4", "Replace moment.js with date-fns (#118)", ["f3c84a7"], 54, "Sam Ortiz"),
    commit("e0b9c18", "Document environment variables", ["f3c84a7"], 55, "Priya Nair", [ref("origin/docs-env-vars", "remoteBranch")]),
    commit("f3c84a7", "Lazy-load dashboard chart widgets (#123)", ["a58e0d2"], 76, "Maya Chen"),
    commit("a58e0d2", "Add dark mode toggle to settings (#115)", ["b1d93f6"], 98, "Priya Nair"),
    commit("b1d93f6", "Fix pagination off-by-one in the orders table", ["c27a6e9"], 122, "Leo Park"),
    commit("c27a6e9", "Bump vite to 7.3 and fix build warnings", ["d83f1b4"], 146, "Sam Ortiz"),
    commit("d83f1b4", "Add CSV export to the reports page", ["e94c0a8"], 170, "Maya Chen"),
    commit("e94c0a8", "Release v2.3.2", ["f05d2c7"], 220, "Priya Nair", [ref("v2.3.2", "tag")]),
    commit("f05d2c7", "Handle the empty state in the invoices list", ["a16e3d9"], 244, "Leo Park"),
    commit("a16e3d9", "Refactor API client error handling", ["b27f4ea"], 290, "Sam Ortiz"),
    commit("b27f4ea", "Update README with deployment steps", ["c38a5fb"], 340, "Priya Nair"),
    commit("c38a5fb", "Add integration tests for the billing webhook", ["d49b60c"], 410, "Leo Park"),
    commit("d49b60c", "Set up CI pipeline with lint, test and build", ["e5ac71d"], 480, "Sam Ortiz"),
  ];

  const check = (status, total, passing, failing, pending) => ({ status, total, passing, failing, pending });
  const pr = (number, title, author, head, hours, extra = {}) => ({
    number, title, author, headBranch: head, baseBranch: "main", state: "open", isDraft: false,
    url: "https://github.com/acme/acme-web/pull/" + number, updatedAt: hoursAgo(hours),
    mergeable: true, mergeStateStatus: "CLEAN", isCrossRepository: false,
    checks: check("success", 4, 4, 0, 0), ...extra,
  });
  const openPrs = [
    pr(128, "Add OAuth login with GitHub provider", "maya-chen", "feature/login", 2),
    pr(127, "Fix flaky checkout test on slow CI runners", "leo-park", "fix/checkout-flaky", 4, { checks: check("success", 3, 3, 0, 0) }),
    pr(126, "Add retry logic to the webhook dispatcher", "leo-park", "feature/webhook-retry", 6, { checks: check("pending", 4, 2, 0, 2) }),
    pr(125, "Upgrade to Node 22 and refresh lockfile", "sam-ortiz", "chore/node-22", 9, { checks: check("failure", 4, 3, 1, 0) }),
    pr(123, "Dashboard: lazy-load chart widgets", "maya-chen", "perf/lazy-charts", 26, { isDraft: true, checks: check("none", 0, 0, 0, 0) }),
    pr(121, "Docs: document environment variables", "priya-nair", "docs-env-vars", 50),
    pr(118, "Replace moment.js with date-fns", "sam-ortiz", "chore/date-fns", 96, { checks: check("success", 5, 5, 0, 0) }),
    pr(115, "Add dark mode toggle to settings", "priya-nair", "feature/dark-mode", 170),
  ];

  h.set("projects.list", async () => [{ id: "p1", name: "acme-web", path: ROOT, isActive: true }]);
  h.set("worktrees.list", async () => [{ id: "w1", name: "feature/login", path: ROOT, isActive: true }]);
  h.set("git.repoInfo", async () => ({ root: ROOT, gitDir: ROOT + "/.git", isWorktree: false, currentBranch: "feature/login" }));
  h.set("git.currentBranch", async () => "feature/login");
  h.set("git.branches", async () => ["feature/login", "main", "fix/checkout-flaky", "chore/node-22"]);
  h.set("git.worktrees", async () => [{ path: ROOT, branch: "feature/login", head: log[0].hash, isBare: false, isDetached: false, isPrunable: false }]);
  h.set("git.status", async () => ({
    branch: "feature/login", defaultBranch: "main", aheadBehind: { ahead: 3, behind: 0 },
    stagedFiles: files.staged, unstagedFiles: files.unstaged, pullRequest: null,
  }));
  h.set("git.log", async ({ maxCount = 50, skip = 0 } = {}) => log.slice(skip, skip + maxCount));
  h.set("git.pr.info", async () => openPrs[0]);
  h.set("git.pr.list", async ({ filter = "open" } = {}) => (filter === "open" || filter === "all" ? openPrs : []));
  h.set("git.pr.diff", async () => ({ diff: PATCH, truncated: false }));
  h.set("git.diff", async ({ staged } = {}) => ({ diff: staged ? PATCH : "" }));
  h.set("exec", async (argv) => {
    if (Array.isArray(argv) && argv[0] === "git" && argv[1] === "remote") return { stdout: "git@github.com:acme/acme-web.git\n", stderr: "", exitCode: 0 };
    if (Array.isArray(argv) && argv[0] === "git" && argv[1] === "show") return { stdout: PATCH, stderr: "", exitCode: 0 };
    if (Array.isArray(argv) && argv[0] === "tea") return { stdout: "", stderr: "", exitCode: 1 };
    return { stdout: "", stderr: "", exitCode: 0 };
  });

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const until = async (test, tries = 100) => { for (let i = 0; i < tries && !test(); i += 1) await sleep(100); };
  const tabButton = (label) => [...document.querySelectorAll("button")].find((b) => b.textContent.trim().endsWith(label));
  h.git = { sleep, until, tabButton };
})();
