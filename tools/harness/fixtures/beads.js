// Sample Beads data for the beads extension: `bd` CLI output served through atur.exec.
(() => {
  const h = window.__harness;
  const ago = (days) => new Date(Date.now() - days * 86400000).toISOString();
  const dep = (id, type = "blocks") => ({ depends_on_id: id, type });

  const issues = [
    { id: "web-101", title: "Design token audit for the dashboard", status: "closed", priority: 2, issue_type: "task", labels: ["design"], created_at: ago(20), updated_at: ago(12), description: "Inventory colors and spacing used across dashboard widgets." },
    { id: "web-102", title: "Set up CI pipeline for preview deploys", status: "closed", priority: 1, issue_type: "task", labels: ["infra"], created_at: ago(19), updated_at: ago(10), description: "Build and publish a preview for every pull request." },
    { id: "web-103", title: "Add OAuth login", status: "in_progress", priority: 1, issue_type: "feature", labels: ["auth", "backend"], created_at: ago(14), updated_at: ago(0), comment_count: 3,
      description: "Let users sign in with an external identity provider.\n\nCover the redirect, callback, and session cookie.",
      acceptance_criteria: "- Sign-in works for a new and an existing user\n- Denied consent shows a clear message\n- Session expires after 7 days",
      design: "Use the authorization-code flow with PKCE. Store sessions server-side.",
      notes: "Callback route is done; the denied-consent state is still open.",
      dependencies: [dep("web-102")] },
    { id: "web-104", title: "Session expiry and refresh handling", status: "open", priority: 1, issue_type: "task", labels: ["auth"], created_at: ago(13), updated_at: ago(2), dependencies: [dep("web-103")] },
    { id: "web-105", title: "Fix flaky checkout test on slow runners", status: "in_progress", priority: 0, issue_type: "bug", labels: ["testing"], created_at: ago(9), updated_at: ago(1), comment_count: 1, dependencies: [dep("web-102")] },
    { id: "web-106", title: "Dashboard: lazy-load chart widgets", status: "open", priority: 2, issue_type: "feature", labels: ["frontend", "perf"], created_at: ago(11), updated_at: ago(3), dependencies: [dep("web-101")] },
    { id: "web-107", title: "Settings page: dark mode toggle", status: "open", priority: 3, issue_type: "feature", labels: ["frontend"], created_at: ago(8), updated_at: ago(5), dependencies: [dep("web-101")] },
    { id: "web-108", title: "Migrate date handling to date-fns", status: "blocked", priority: 2, issue_type: "task", labels: ["tech-debt"], created_at: ago(16), updated_at: ago(7), dependencies: [dep("web-105")] },
    { id: "web-109", title: "Upgrade to Node 22 and refresh lockfile", status: "open", priority: 2, issue_type: "chore", labels: ["infra"], created_at: ago(7), updated_at: ago(4), dependencies: [dep("web-102")] },
    { id: "web-110", title: "Document environment variables", status: "open", priority: 3, issue_type: "task", labels: ["docs"], created_at: ago(6), updated_at: ago(6) },
    { id: "web-111", title: "Rate limit the public API", status: "blocked", priority: 1, issue_type: "feature", labels: ["backend", "security"], created_at: ago(15), updated_at: ago(9), dependencies: [dep("web-103"), dep("web-109")] },
    { id: "web-112", title: "Audit log for admin actions", status: "deferred", priority: 3, issue_type: "feature", labels: ["backend"], created_at: ago(25), updated_at: ago(18), dependencies: [dep("web-103")] },
    { id: "web-113", title: "Accessibility pass on form controls", status: "open", priority: 2, issue_type: "task", labels: ["frontend", "a11y"], created_at: ago(5), updated_at: ago(1), dependencies: [dep("web-107")] },
    { id: "web-114", title: "Write onboarding guide", status: "closed", priority: 3, issue_type: "task", labels: ["docs"], created_at: ago(22), updated_at: ago(14) },
    { id: "web-115", title: "Replace placeholder empty states", status: "open", priority: 2, issue_type: "task", labels: ["design", "frontend"], created_at: ago(4), updated_at: ago(0), dependencies: [dep("web-106")] },
    { id: "web-116", title: "Release checklist for 1.0", status: "open", priority: 1, issue_type: "epic", labels: ["release"], created_at: ago(10), updated_at: ago(2), dependencies: [dep("web-104"), dep("web-111"), dep("web-113")] },
  ].map((issue) => ({ dependencies: [], comment_count: 0, ...issue }));

  const ready = ["web-104x", "web-106", "web-107", "web-109", "web-110", "web-113", "web-115"];
  // Ready work = open issues whose blockers are all closed.
  const byId = new Map(issues.map((i) => [i.id, i]));
  const readyIssues = issues.filter((i) => i.status === "open" && i.dependencies.every((d) => byId.get(d.depends_on_id)?.status === "closed"));
  void ready;

  h.set("projects.list", async () => [{ id: "p1", name: "acme-web", path: "/home/dev/acme-web", isActive: true }]);
  h.set("worktrees.list", async () => [{ id: "w1", path: "/home/dev/acme-web", isActive: true }]);
  h.set("files.read", async (path) => {
    if (path === "package.json") return { content: JSON.stringify({ name: "acme-web" }) };
    throw new Error("not found");
  });
  h.set("exec", async (argv) => {
    const ok = (stdout) => ({ stdout, stderr: "", exitCode: 0 });
    if (argv[0] === "bd" && argv[1] === "list") return ok(JSON.stringify(issues));
    if (argv[0] === "bd" && argv[1] === "ready") return ok(JSON.stringify(readyIssues));
    if (argv[0] === "bd" && argv[1] === "events") return { stdout: "", stderr: "events journal is disabled", exitCode: 0 };
    return ok("");
  });

  const scene = (window.atur.data && window.atur.data.scene) || "board";
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const until = async (test) => { for (let i = 0; i < 100 && !test(); i += 1) await sleep(100); };
  window.addEventListener("load", async () => {
    await until(() => document.querySelector(".card"));
    const view = { board: "Board", graph: "Graph", insights: "Insights" }[scene];
    const button = [...document.querySelectorAll(".view-button")].find((b) => b.textContent === view);
    if (button && scene !== "board") button.click();
    await sleep(400);
    if (scene === "board") {
      [...document.querySelectorAll(".card")].find((c) => c.textContent.includes("web-103"))?.click();
    }
    if (scene === "graph") {
      await until(() => document.querySelector(".graph-node, .graph-scroll"));
    }
    await sleep(500);
    window.__ready = true;
  });
})();
