// Sample GitHub Actions data for the ci-dashboard extension: `gh` output served through atur.exec.
(() => {
  const h = window.__harness;
  const scene = (h.data && h.data.scene) || "runs";
  const ago = (hours) => new Date(Date.now() - hours * 3600 * 1000).toISOString();
  const ROOT = "/home/dev/acme-web";
  const SLUG = "acme/acme-web";
  const sha = (n) => (n.toString(16) + "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678").slice(0, 40);

  const stored = {
    sources: [{ id: "s-gh", kind: "github", label: "GitHub Actions", enabled: true }],
    detectionDismissed: true,
  };
  h.memory.set("sources:v1:" + ROOT, stored);
  h.memory.set("sources:v1:unknown", stored);

  const run = (id, number, title, workflow, status, conclusion, branch, event, hoursAgo, minutes) => ({
    databaseId: id, number, displayTitle: title, workflowName: workflow, status, conclusion,
    headBranch: branch, headSha: sha(id), event,
    createdAt: ago(hoursAgo), startedAt: ago(hoursAgo), updatedAt: ago(hoursAgo - minutes / 60),
    url: "https://github.com/" + SLUG + "/actions/runs/" + id,
  });
  const job = (id, name, conclusion, steps) => ({
    databaseId: id, name, status: "completed", conclusion, startedAt: ago(2), completedAt: ago(1.9),
    url: "https://github.com/" + SLUG + "/actions/runs/9921/job/" + id,
    steps: steps.map(([n, c], i) => ({ name: n, number: i + 1, status: "completed", conclusion: c })),
  });

  const runs = [
    run(9930, 412, "Add OAuth login with GitHub provider", "CI", "in_progress", "", "main", "push", 0.1, 0),
    run(9921, 411, "Fix flaky checkout test", "CI", "completed", "failure", "main", "push", 2, 7),
    run(9915, 410, "Upgrade to Node 22", "CI", "completed", "success", "main", "push", 5, 6),
    run(9908, 409, "Release v2.4.0", "Deploy", "completed", "success", "main", "workflow_dispatch", 9, 11),
    run(9899, 408, "Dashboard: lazy-load chart widgets", "CI", "completed", "success", "main", "pull_request", 14, 6),
    run(9890, 407, "Docs: document environment variables", "CI", "completed", "success", "main", "push", 22, 5),
    run(9884, 406, "Nightly dependency audit", "Audit", "completed", "cancelled", "main", "schedule", 30, 2),
    run(9877, 405, "Replace moment.js with date-fns", "CI", "completed", "success", "main", "push", 50, 6),
  ];
  const jobsFor = {
    9921: [
      job(1, "build", "success", [["Set up job", "success"], ["Checkout", "success"], ["Install dependencies", "success"], ["Build", "success"]]),
      job(2, "lint", "success", [["Set up job", "success"], ["Run eslint", "success"]]),
      job(3, "test", "failure", [["Set up job", "success"], ["Run unit tests", "failure"]]),
      job(4, "e2e", "skipped", []),
    ],
  };
  const failLog = [
    ["test", "Run unit tests", "> acme-web@2.3.0 test"],
    ["test", "Run unit tests", "> vitest run"],
    ["test", "Run unit tests", " RUN  v1.6.0 /home/runner/work/acme-web"],
    ["test", "Run unit tests", " \u2713 src/cart/totals.test.ts (12 tests)"],
    ["test", "Run unit tests", " \u2717 src/checkout/submit.test.ts > submits the order"],
    ["test", "Run unit tests", "AssertionError: expected 'pending' to be 'confirmed'"],
    ["test", "Run unit tests", "    at src/checkout/submit.test.ts:48:21"],
    ["test", "Run unit tests", " Test Files  1 failed | 14 passed (15)"],
    ["test", "Run unit tests", "      Tests  1 failed | 96 passed (97)"],
    ["test", "Run unit tests", "##[error]Process completed with exit code 1."],
  ].map(([j, s, t]) => `${j}\t${s}\t${ago(2)} ${t}`).join("\n");

  const deployments = [
    { id: 1, environment: "production", ref: "v2.4.0", sha: sha(9908), created_at: ago(9), updated_at: ago(9) },
    { id: 2, environment: "staging", ref: "main", sha: sha(9915), created_at: ago(5), updated_at: ago(5) },
    { id: 3, environment: "preview", ref: "feature/login", sha: sha(9930), created_at: ago(1), updated_at: ago(1) },
  ];

  h.set("projects.list", async () => [{ id: "p1", name: "acme-web", path: ROOT, isActive: true }]);
  h.set("git.repoInfo", async () => { console.log("repoInfo called"); return { root: ROOT, gitDir: ROOT + "/.git", isWorktree: false, currentBranch: "main" }; });
  h.set("git.currentBranch", async () => "main");
  h.set("git.branches", async () => ["main", "develop", "feature/login"]);
  h.set("files.stat", async () => null);
  h.set("exec", async (argv) => {
    const out = (stdout) => ({ stdout, stderr: "", exitCode: 0 });
    const json = (v) => out(JSON.stringify(v));
    if (argv[0] === "which") return out("/usr/bin/" + argv[1] + "\n");
    if (argv[0] === "git" && argv[1] === "cat-file") return out("");
    if (argv[0] === "git" && argv[1] === "log") {
      return out(["3f2a9c1\x1fLeo Park\x1fcheckout: await order confirmation in submit()",
        "b81d0e7\x1fSam Ortiz\x1fchore: bump vitest to 1.6",
        "9c4e5a2\x1fMaya Chen\x1fcart: recompute totals after coupon"].join("\n"));
    }
    if (argv[0] !== "gh") return out("");
    if (argv[1] === "run" && argv[2] === "list") return json(runs);
    if (argv[1] === "run" && argv[2] === "view") {
      if (argv.includes("--log-failed")) return out(failLog);
      const r = runs.find((x) => String(x.databaseId) === argv[3]);
      return json({ ...r, jobs: jobsFor[r.databaseId] || [
        job(11, "build", "success", [["Set up job", "success"], ["Build", "success"]]),
        job(12, "test", "success", [["Set up job", "success"], ["Run unit tests", "success"]]),
      ] });
    }
    if (argv[1] === "repo") return out(SLUG + "\n");
    if (argv[1] === "api") {
      const ep = argv[2];
      if (/deployments\?/.test(ep)) return json(deployments);
      if (/statuses/.test(ep)) return json([{ state: "success", environment_url: "https://" + (ep.includes("/1/") ? "app" : ep.includes("/2/") ? "staging" : "preview") + ".acme-web.example" }]);
    }
    return out("[]");
  });

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const until = async (test) => { for (let i = 0; i < 100 && !test(); i += 1) await sleep(100); };
  window.addEventListener("load", async () => {
    await until(() => document.querySelector(".run"));
    console.log("memory keys " + JSON.stringify([...h.memory.keys()]) + " runs " + document.querySelectorAll(".run").length);
    if (scene === "detail") {
      document.querySelector('.run[data-run="9921"]').click();
      await until(() => document.querySelector(".detail__title"));
    } else if (scene === "envs") {
      document.querySelector("[data-view=envs]").click();
      await until(() => document.querySelector(".env"));
    }
    await sleep(600);
    window.__ready = true;
  });
})();
