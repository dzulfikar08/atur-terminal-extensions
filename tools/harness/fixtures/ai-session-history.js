// Sample CLI session stores for the ai-session-history extension: a virtual home directory
// served through the host commands (ls, stat, head, printenv, ...) the extension runs with atur.exec.
(() => {
  const h = window.__harness;
  const HOME = "/home/dev";
  const CWD = HOME + "/acme-web";
  const nowSec = Math.floor(Date.now() / 1000);
  const ago = (minutes) => nowSec - minutes * 60;

  const files = new Map(); // absolute path -> { kind, mtime, content }
  const addDir = (path, mtime) => files.set(path, { kind: "dir", mtime, content: "" });
  const addFile = (path, mtime, content) => files.set(path, { kind: "file", mtime, content });

  const slug = CWD.replace(/[^A-Za-z0-9]/g, "-");
  const claudeDir = `${HOME}/.claude/projects/${slug}`;
  addDir(`${HOME}/.claude`, ago(5));
  addDir(`${HOME}/.claude/projects`, ago(5));
  addDir(claudeDir, ago(5));
  const claude = [
    ["3f6c1d52-8a4e-4c1b-9d27-5b0e61a7c901", 6, "Add OAuth login with GitHub provider", "feature/login"],
    ["a91b7e03-52c8-4f6d-8e14-7c2d90b3f6a2", 48, "Fix flaky checkout test on slow CI runners", "fix/checkout-flaky"],
    ["c4d8f2a7-1b36-4e59-a0c3-9e7d5128b4f3", 190, "Refactor dashboard chart widgets to lazy-load", "main"],
    ["0e5b9a34-7d12-4c88-b6f1-3a8c2d49e705", 1500, "Upgrade to Node 22 and refresh lockfile", "chore/node-22"],
    ["7b2e4c90-d3a5-41f8-9c67-e1f0a85d3b16", 3100, "Explain how the session middleware rotates cookies", "main"],
    ["d58a1f6e-93c4-4b07-8a2d-4f6e7c0b9128", 5900, "Document environment variables in the README", "docs/env-vars"],
  ];
  for (const [id, mins, title, branch] of claude) {
    const head = [
      { type: "user", cwd: CWD, gitBranch: branch, message: { role: "user", content: title } },
      { type: "ai-title", title },
    ].map((r) => JSON.stringify(r)).join("\n") + "\n";
    addFile(`${claudeDir}/${id}.jsonl`, ago(mins), head);
  }

  const grokRoot = `${HOME}/.grok/sessions/${encodeURIComponent(CWD)}`;
  addDir(`${HOME}/.grok`, ago(5));
  addDir(`${HOME}/.grok/sessions`, ago(5));
  addDir(grokRoot, ago(5));
  const grok = [
    ["5e1a3b78-2c94-4d06-b8f5-6a0d7c91e342", 22, "Profile slow dashboard renders"],
    ["b3c7e910-4f58-4a2d-91e6-0d8a5c7b3f64", 760, "Write unit tests for the auth callback"],
    ["8d0f6a25-e1b9-47c3-a5d8-2b4e9f1c6a07", 4300, "Triage open accessibility issues"],
  ];
  for (const [id, mins, title] of grok) {
    const dir = `${grokRoot}/${id}`;
    addDir(dir, ago(mins));
    addFile(`${dir}/summary.json`, ago(mins), JSON.stringify({
      info: { id }, generated_title: title, updated_at: new Date((ago(mins)) * 1000).toISOString(),
    }));
  }

  const ok = (stdout) => ({ stdout, stderr: "", exitCode: 0 });
  const fail = (stderr) => ({ stdout: "", stderr, exitCode: 1 });
  const childrenOf = (dir) => {
    const prefix = dir.replace(/\/+$/, "") + "/";
    const names = [];
    for (const path of files.keys()) {
      if (path.startsWith(prefix) && !path.slice(prefix.length).includes("/")) names.push(path.slice(prefix.length));
    }
    return names;
  };

  h.set("projects.list", async () => [{ id: "p1", name: "acme-web", path: CWD, isActive: true }]);
  h.set("worktrees.list", async () => [{ id: "w1", path: CWD, branch: "feature/login", isActive: true }]);
  h.set("notifications.notify", async () => {});
  h.set("exec", async (argv) => {
    const [bin, ...args] = argv;
    if (bin === "bash") return ok("claude=/usr/local/bin/claude\ngrok=/usr/local/bin/grok\n");
    if (bin === "/usr/bin/printenv") return args[args.length - 1] === "HOME" ? ok(HOME + "\n") : fail("");
    if (bin === "/bin/ls") {
      const dashes = args.indexOf("--");
      const target = args[dashes + 1];
      if (args[0] === "-1A") {
        if (!files.has(target)) return fail("ls: No such file or directory");
        return ok(childrenOf(target).join("\n") + "\n");
      }
      if (target.startsWith("/bin/") || target.startsWith("/usr/bin/")) return target.endsWith("sqlite3") ? fail("not found") : ok(target + "\n");
      return files.has(target) ? ok(target + "\n") : fail("ls: No such file or directory");
    }
    if (bin === "/usr/bin/stat") {
      if (args[1] === "-f") return fail("stat: illegal option");
      const paths = args.slice(args.indexOf("--") + 1);
      return ok(paths.filter((p) => files.has(p)).map((p) => {
        const f = files.get(p);
        return [p, f.kind === "dir" ? "directory" : "regular file", f.mtime, f.content.length].join("\t");
      }).join("\n") + "\n");
    }
    if (bin === "/usr/bin/head") {
      const path = args[args.indexOf("--") + 1];
      const f = files.get(path);
      return f ? ok(f.content.slice(0, Number(args[1]))) : fail("head: No such file or directory");
    }
    if (bin === "/bin/cat") {
      const f = files.get(args[args.indexOf("--") + 1]);
      return f ? ok(f.content) : fail("cat: No such file or directory");
    }
    return ok("");
  });

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const until = async (test) => { for (let i = 0; i < 100 && !test(); i += 1) await sleep(100); };
  window.addEventListener("load", async () => {
    await until(() => document.querySelectorAll("button, [role=button]").length > 3 && document.body.textContent.includes("OAuth login"));
    await sleep(500);
    window.__ready = true;
  });
})();
