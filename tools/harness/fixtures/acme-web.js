// A believable sample project, "acme-web", served through the mock host for the listing
// screenshots of the files and file-tree extensions. Page options come from the query string
// (so one fixture serves several cases):
//   file, line, column   file the editor tab shows (files extension)
//   expanded=a,b/c       folders the tree starts expanded
//   selected             row that is selected / active
//   icons=material       the files extension's colored icon theme
(() => {
  const h = window.__harness;
  const q = new URLSearchParams(location.search);
  const ROOT = "/home/alex/code/acme-web";

  const storage = new Map();
  const shim = {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => { storage.set(String(k), String(v)); },
    removeItem: (k) => { storage.delete(k); },
    clear: () => storage.clear(),
    key: (i) => [...storage.keys()][i] ?? null,
    get length() { return storage.size; },
  };
  Object.defineProperty(window, "localStorage", { configurable: true, get: () => shim });

  const expanded = (q.get("expanded") || "").split(",").map((p) => p.trim()).filter(Boolean);
  const selected = q.get("selected") || null;
  if (h.owner === "files") {
    storage.set("atur.files.icon-theme", q.get("icons") === "material" ? "material" : "stroke");
    storage.set(
      "atur.files.tree-memory:" + ROOT,
      JSON.stringify({ expanded: expanded.map((p) => p + "/"), selected }),
    );
  } else {
    storage.set("atur-file-tree:expanded:" + encodeURIComponent(ROOT), JSON.stringify(expanded));
  }

  const sessionTs = [
    'import { cookies } from "next/headers";',
    'import { z } from "zod";',
    'import { db } from "@/lib/db";',
    "",
    'const SESSION_COOKIE = "acme_session";',
    "const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;",
    "",
    "const sessionSchema = z.object({",
    "  id: z.string().uuid(),",
    "  userId: z.string(),",
    "  expiresAt: z.number(),",
    "});",
    "",
    "export type Session = z.infer<typeof sessionSchema>;",
    "",
    "/** Look up the session for the current request, or null when signed out. */",
    "export async function getSession(): Promise<Session | null> {",
    "  const token = cookies().get(SESSION_COOKIE)?.value;",
    "  if (!token) return null;",
    "",
    "  const row = await db.session.findUnique({ where: { token } });",
    "  if (!row) return null;",
    "",
    "  const parsed = sessionSchema.safeParse(row);",
    "  if (!parsed.success || parsed.data.expiresAt < Date.now()) {",
    "    await destroySession(token);",
    "    return null;",
    "  }",
    "  return parsed.data;",
    "}",
    "",
    "export async function createSession(userId: string): Promise<Session> {",
    "  const token = crypto.randomUUID();",
    "  const expiresAt = Date.now() + SESSION_TTL_MS;",
    "  const row = await db.session.create({ data: { token, userId, expiresAt } });",
    "",
    "  cookies().set(SESSION_COOKIE, token, {",
    "    httpOnly: true,",
    '    sameSite: "lax",',
    '    secure: process.env.NODE_ENV === "production",',
    "    expires: expiresAt,",
    "  });",
    "  return sessionSchema.parse(row);",
    "}",
    "",
    "export async function destroySession(token: string): Promise<void> {",
    "  await db.session.deleteMany({ where: { token } });",
    "  cookies().delete(SESSION_COOKIE);",
    "}",
    "",
  ];
  // What HEAD had: a one day TTL, no doc comment, no `secure` flag and a leftover log line.
  const sessionBase = sessionTs
    .filter((line) => !line.startsWith("/** Look up") && !line.includes("secure: process.env"))
    .map((line) => (line.startsWith("const SESSION_TTL_MS") ? "const SESSION_TTL_MS = 1000 * 60 * 60 * 24;" : line))
    .flatMap((line) => (line.startsWith("  await db.session.deleteMany") ? ['  console.log("destroying session", token);', line] : [line]));

  const readme = [
    "# acme-web",
    "",
    "The storefront for Acme: product catalogue, cart and checkout, built with Next.js and TypeScript.",
    "",
    "## Getting started",
    "",
    "Install dependencies and start the dev server:",
    "",
    "```sh",
    "npm install",
    "cp .env.example .env.local",
    "npm run dev",
    "```",
    "",
    "The app is then available at http://localhost:3000.",
    "",
    "## Project layout",
    "",
    "- `src/app` routes and layouts (App Router)",
    "- `src/components` shared UI such as the header, product cards and the cart drawer",
    "- `src/lib` data access, session handling and formatting helpers",
    "- `tests` unit tests, run with Vitest",
    "",
    "## Scripts",
    "",
    "| Command | What it does |",
    "| --- | --- |",
    "| `npm run dev` | Start the dev server with hot reload |",
    "| `npm run build` | Create an optimized production build |",
    "| `npm test` | Run the unit tests |",
    "| `npm run lint` | Lint the project |",
    "",
    "> Sessions are stored server-side and expire after seven days.",
    "",
    "## Contributing",
    "",
    "1. Create a branch from `main`.",
    "2. Keep changes focused and add tests for new behavior.",
    "3. Open a pull request; CI runs lint, tests and a build.",
    "",
  ];

  const contents = new Map([
    ["src/lib/session.ts", sessionTs.join("\n")],
    ["README.md", readme.join("\n")],
    ["package.json", '{\n  "name": "acme-web",\n  "version": "0.4.0",\n  "private": true\n}\n'],
  ]);
  const baselines = new Map([
    ["src/lib/session.ts", sessionBase.join("\n")],
    ["README.md", readme.filter((l) => !l.startsWith("> Sessions")).join("\n")],
  ]);

  const filePaths = [
    ".github/workflows/ci.yml",
    "public/favicon.svg",
    "public/logo.svg",
    "src/app/layout.tsx",
    "src/app/page.tsx",
    "src/app/globals.css",
    "src/app/products/page.tsx",
    "src/app/cart/page.tsx",
    "src/components/Button.tsx",
    "src/components/CartDrawer.tsx",
    "src/components/Header.tsx",
    "src/components/ProductCard.tsx",
    "src/hooks/useCart.ts",
    "src/lib/api.ts",
    "src/lib/db.ts",
    "src/lib/format.ts",
    "src/lib/session.ts",
    "tests/format.test.ts",
    "tests/session.test.ts",
    "node_modules/next/package.json",
    "node_modules/react/package.json",
    ".env.local",
    ".eslintrc.json",
    ".gitignore",
    "README.md",
    "next.config.mjs",
    "package-lock.json",
    "package.json",
    "tsconfig.json",
  ];
  const children = new Map([["", new Set()]]);
  const dirs = new Set([""]);
  for (const path of filePaths) {
    const parts = path.split("/");
    let parent = "";
    parts.forEach((name, index) => {
      const full = parent ? parent + "/" + name : name;
      if (!children.has(parent)) children.set(parent, new Set());
      children.get(parent).add(full);
      if (index < parts.length - 1) { dirs.add(full); if (!children.has(full)) children.set(full, new Set()); }
      parent = full;
    });
  }
  const norm = (p) => String(p || "").replace(/^\/+|\/+$/g, "");
  const ignored = (path) => path === ".env.local" || path === "node_modules" || path.startsWith("node_modules/");

  h.set("projects.list", async () => [{ id: "p1", name: "acme-web", path: ROOT, isActive: true }]);
  h.set("worktrees.list", async () => [{ id: "w1", name: "main", path: ROOT, isActive: true, isPrimary: true }]);
  h.set("files.list", async (path) => [...(children.get(norm(path)) || [])].map((full) => ({
    name: full.split("/").pop(),
    path: full,
    isDirectory: dirs.has(full),
    isIgnored: ignored(full),
  })));
  h.set("files.read", async (path) => {
    const key = norm(path);
    if (!filePaths.includes(key)) throw new Error("No such file: " + key);
    const content = contents.get(key) ?? "";
    return { path: key, content, size: content.length };
  });
  h.set("files.stat", async (path) => {
    const key = norm(path);
    const isDirectory = dirs.has(key);
    if (!isDirectory && !filePaths.includes(key)) throw new Error("No such file: " + key);
    return { path: key, name: key.split("/").pop(), isDirectory, size: (contents.get(key) ?? "").length };
  });
  h.set("git.status", async () => ({
    branch: "feature/login",
    unstagedFiles: [
      { path: "src/lib/session.ts", status: "M", isStaged: false, isUnstaged: true },
      { path: "src/components/CartDrawer.tsx", status: "M", isStaged: false, isUnstaged: true },
      { path: "README.md", status: "M", isStaged: false, isUnstaged: true },
      { path: "tests/session.test.ts", status: "?", isStaged: false, isUnstaged: true },
    ],
    stagedFiles: [{ path: "src/hooks/useCart.ts", status: "A", isStaged: true, isUnstaged: false }],
  }));
  h.set("exec", async (argv) => {
    if (argv[0] === "pwd") return { exitCode: 0, stdout: ROOT + "\n", stderr: "" };
    if (argv[0] === "git" && argv[1] === "show") {
      const base = baselines.get(String(argv[2]).replace(/^HEAD:/, ""));
      if (base !== undefined) return { exitCode: 0, stdout: base, stderr: "" };
    }
    return { exitCode: 1, stdout: "", stderr: "" };
  });

  if (/\/editor\.html$/.test(location.pathname)) {
    const data = { filePath: q.get("file") || "src/lib/session.ts", replaceable: false };
    if (q.get("line")) data.line = Number(q.get("line"));
    if (q.get("column")) data.column = Number(q.get("column"));
    h.base.data = data;
  }
})();
