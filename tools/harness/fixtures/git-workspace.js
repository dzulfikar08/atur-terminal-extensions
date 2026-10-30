// A workspace folder holding three repositories; the panel opens on acme-api.
(() => {
  const h = window.__harness;
  const WORKSPACE = "/home/dev/acme-workspace";
  const REPO = WORKSPACE + "/acme-api";
  const FS = "\x1f";
  const RS = "\x1e";
  const hoursAgo = (n) => new Date(Date.now() - n * 3600 * 1000).toISOString();
  const ok = (stdout = "") => ({ stdout, stderr: "", exitCode: 0 });
  const fail = () => ({ stdout: "", stderr: "", exitCode: 1 });

  const porcelain = [
    "# branch.oid 5b1e0c9d3a7f48e26a1c0d9e8f7a6b5c4d3e2f10",
    "# branch.head feature/rate-limiting",
    "# branch.upstream origin/feature/rate-limiting",
    "# branch.ab +2 -0",
    "1 A. N... 000000 100644 100644 0000000 1a2b3c4 src/middleware/rateLimit.js",
    "1 M. N... 100644 100644 100644 2b3c4d5 3c4d5e6 src/config/index.js",
    "1 .M N... 100644 100644 100644 4d5e6f7 5e6f7a8 src/routes/orders.js",
    "1 .M N... 100644 100644 100644 6f7a8b9 7a8b9c0 src/routes/users.js",
    "1 .M N... 100644 100644 100644 8b9c0d1 9c0d1e2 package.json",
    "? tests/rateLimit.test.js",
  ].join("\n");
  const numstat = { "src/routes/orders.js": [14, 3], "src/routes/users.js": [6, 2], "package.json": [1, 0] };
  const cachedNumstat = { "src/middleware/rateLimit.js": [48, 0], "src/config/index.js": [5, 1] };
  const toNumstat = (map) => Object.entries(map).map(([path, [a, d]]) => `${a}\t${d}\t${path}`).join("\n");

  const commit = (hash, subject, parents, hours, author, refs = "") =>
    [hash.padEnd(40, "0"), hash, subject, author, hoursAgo(hours), parents.map((p) => p.padEnd(40, "0")).join(" "), refs].join(FS);
  const log = [
    commit("5b1e0c9", "Add sliding-window rate limiter middleware", ["6c2f1da"], 1, "Maya Chen", "HEAD -> feature/rate-limiting, origin/feature/rate-limiting"),
    commit("6c2f1da", "Read rate limit settings from config", ["7d30e2b"], 3, "Maya Chen"),
    commit("7d30e2b", "Return 429 with a Retry-After header", ["8e41f3c"], 6, "Leo Park", "origin/main, main"),
    commit("8e41f3c", "Paginate the orders endpoint (#212)", ["9f5204d"], 22, "Sam Ortiz"),
    commit("9f5204d", "Release v1.8.0", ["a06315e"], 30, "Priya Nair", "tag: v1.8.0"),
    commit("a06315e", "Validate order payloads with zod", ["b17426f"], 52, "Leo Park"),
    commit("b17426f", "Add health check endpoint", ["c28537a"], 76, "Sam Ortiz"),
    commit("c28537a", "Switch to structured JSON logging", ["d39648b"], 120, "Maya Chen"),
    commit("d39648b", "Set up CI with lint and test jobs", [], 200, "Priya Nair"),
  ].join(RS);

  h.set("projects.list", async () => [{ id: "p1", name: "acme-workspace", path: WORKSPACE, isActive: true }]);
  h.set("worktrees.list", async () => [{ id: "w1", name: "acme-workspace", path: WORKSPACE, isPrimary: true, isActive: true }]);
  h.set("exec", async (argv, opts = {}) => {
    if (!Array.isArray(argv)) return ok();
    const [bin, ...args] = argv;
    const cwd = opts.cwd || "";
    if (bin === "find") return ok(["acme-api", "acme-mobile", "acme-web"].map((name) => `${WORKSPACE}/${name}/.git`).join("\n") + "\n");
    if (bin !== "git") return fail();
    const sub = args[0] === "-C" ? args[2] : args[0];
    if (args[0] === "-C") return args[1] === REPO ? ok(REPO + "\n") : fail();
    if (cwd !== REPO) return fail();
    if (sub === "rev-parse" && args.includes("--show-toplevel")) return ok(REPO + "\n");
    if (sub === "rev-parse" && args.includes("--git-dir")) return ok(".git\n");
    if (sub === "rev-parse") return fail();
    if (sub === "branch" && args.includes("--show-current")) return ok("feature/rate-limiting\n");
    if (sub === "branch") return ok("feature/rate-limiting\0*\nmain\0 \n");
    if (sub === "symbolic-ref") return ok("refs/remotes/origin/main\n");
    if (sub === "status") return ok(porcelain.replace(/\n/g, "\0") + "\0");
    if (sub === "diff" && args.includes("--numstat") && args.includes("--cached")) return ok(toNumstat(cachedNumstat));
    if (sub === "diff" && args.includes("--numstat") && args.includes("--no-index")) return ok("42\t0\ttests/rateLimit.test.js\n");
    if (sub === "diff" && args.includes("--numstat")) return ok(toNumstat(numstat));
    if (sub === "log") return ok(log);
    if (sub === "remote") return ok("git@github.com:acme/acme-api.git\n");
    return fail();
  });
})();
