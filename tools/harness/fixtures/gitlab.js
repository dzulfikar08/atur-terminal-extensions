// Sample GitLab data for the gitlab extension: `glab api` output served through atur.exec.
(() => {
  const h = window.__harness;
  const scene = (h.data && h.data.scene) || "mr";
  const ago = (hours) => new Date(Date.now() - hours * 3600 * 1000).toISOString();
  const PATH = "acme/acme-web";
  const user = (username, name) => ({ id: username.length * 7, username, name, state: "active" });
  const maya = user("maya-chen", "Maya Chen"), leo = user("leo-park", "Leo Park"),
    sam = user("sam-ortiz", "Sam Ortiz"), priya = user("priya-nair", "Priya Nair");
  const lab = (name, color) => ({ name, color, text_color: "#ffffff" });
  const L = { feature: lab("feature", "#1f6feb"), bug: lab("bug", "#d73a4a"), auth: lab("auth", "#8957e5"), docs: lab("docs", "#0e8a16"), ci: lab("ci", "#e99695") };
  const web = "https://gitlab.com/" + PATH;

  const mrs = [
    { iid: 128, title: "Add OAuth login with GitLab provider", state: "opened", draft: false, author: maya, labels: [L.feature, L.auth], updated_at: ago(2), created_at: ago(30) },
    { iid: 127, title: "Fix flaky checkout test on slow runners", state: "opened", draft: false, author: leo, labels: [L.bug, L.ci], updated_at: ago(4), created_at: ago(20) },
    { iid: 125, title: "Upgrade to Node 22 and refresh lockfile", state: "opened", draft: false, author: sam, labels: [L.ci], updated_at: ago(9), created_at: ago(40) },
    { iid: 123, title: "Dashboard: lazy-load chart widgets", state: "opened", draft: true, author: maya, labels: [L.feature], updated_at: ago(26), created_at: ago(60) },
    { iid: 121, title: "Docs: document environment variables", state: "opened", draft: false, author: priya, labels: [L.docs], updated_at: ago(50), created_at: ago(80) },
    { iid: 118, title: "Replace moment.js with date-fns", state: "opened", draft: false, author: sam, labels: [], updated_at: ago(96), created_at: ago(120) },
    { iid: 115, title: "Add dark mode toggle to settings", state: "opened", draft: false, author: priya, labels: [L.feature], updated_at: ago(170), created_at: ago(200) },
  ];
  const mr128 = {
    ...mrs[0], web_url: web + "/-/merge_requests/128", source_branch: "feature/login", target_branch: "main",
    changes_count: "14", detailed_merge_status: "not_approved", assignees: [maya], reviewers: [leo, priya],
    milestone: { title: "v2.4" },
    head_pipeline: { status: "success", web_url: web + "/-/pipelines/9012" },
    description: "## Summary\n\nAdds a **Sign in with GitLab** flow so users can authenticate without a password.\n\n## Changes\n\n- New `/auth/gitlab` redirect and callback routes\n- Login page gets a provider button and an error state\n- Session cookie now records the identity provider\n\nCloses #212",
  };
  const mr128Notes = [
    { id: 1, system: false, author: leo, created_at: ago(5), body: "Looks good overall. Can we add a test for the denied-consent path?" },
    { id: 2, system: false, author: maya, created_at: ago(2), body: "Added in `auth/callback.test.ts`. Ready for another look." },
  ];
  const issues = [
    { iid: 212, title: "Users cannot sign in without a password", state: "opened", author: priya, labels: [L.feature, L.auth], updated_at: ago(3), created_at: ago(90) },
    { iid: 210, title: "Checkout total rounds incorrectly for JPY", state: "opened", author: leo, labels: [L.bug], updated_at: ago(7), created_at: ago(70) },
    { iid: 207, title: "Document the release process", state: "opened", author: sam, labels: [L.docs], updated_at: ago(30), created_at: ago(150) },
    { iid: 204, title: "Pipeline cache is not restored on main", state: "opened", author: maya, labels: [L.ci, L.bug], updated_at: ago(52), created_at: ago(180) },
    { iid: 199, title: "Support CSV export on the orders page", state: "opened", author: priya, labels: [L.feature], updated_at: ago(120), created_at: ago(300) },
    { iid: 196, title: "Typo on the pricing page", state: "opened", author: sam, labels: [L.docs], updated_at: ago(200), created_at: ago(400) },
  ];

  h.set("projects.list", async () => [{ id: "p1", name: "acme-web", path: "/home/dev/acme-web", isActive: true }]);
  h.set("exec", async (argv) => {
    const out = (stdout) => ({ stdout, stderr: "", exitCode: 0 });
    if (argv[0] === "git" && argv[1] === "remote" && argv[2] === "get-url") return out("git@gitlab.com:" + PATH + ".git\n");
    if (argv[0] === "git" && argv[1] === "remote") return out("origin\n");
    if (argv[0] !== "glab") return out("");
    const ep = argv[argv.length - 1];
    const json = (v) => out(JSON.stringify(v));
    if (ep === "user") return json(maya);
    if (/\/labels/.test(ep)) return json(Object.values(L));
    if (/\/members\/all/.test(ep)) return json([maya, leo, sam, priya]);
    if (/\/merge_requests\/128\/notes/.test(ep)) return json(mr128Notes);
    if (/\/merge_requests\/128\/approvals/.test(ep)) return json({ approvals_required: 2, approved_by: [{ user: leo }] });
    if (/\/merge_requests\/128(\?|$)/.test(ep)) return json(mr128);
    if (/\/merge_requests\?/.test(ep)) return json(mrs);
    if (/\/issues\?/.test(ep)) return json(issues);
    if (/\/notes/.test(ep)) return json([]);
    if (/^projects\/[^/?]+$/.test(ep)) return json({ id: 4242, path_with_namespace: PATH, web_url: web, default_branch: "main" });
    return json([]);
  });

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const until = async (test) => { for (let i = 0; i < 100 && !test(); i += 1) await sleep(100); };
  window.addEventListener("load", async () => {
    await until(() => document.querySelector(".issue"));
    if (scene !== "issues") {
      document.querySelector("[data-mode=mrs]").click();
      await sleep(300);
      await until(() => document.querySelector('.issue[data-iid="128"]'));
    }
    if (scene === "detail") {
      document.querySelector('.issue[data-iid="128"]').click();
      await until(() => document.querySelector(".detail__title"));
    }
    await sleep(500);
    window.__ready = true;
  });
})();
