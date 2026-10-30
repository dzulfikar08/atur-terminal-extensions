// Sample GitHub data for the github extension: gh CLI output served through atur.exec.
(() => {
  const h = window.__harness;
  const ago = (hours) => new Date(Date.now() - hours * 3600 * 1000).toISOString();
  const REPO = "acme/acme-web";

  const prs = [
    {
      number: 128, title: "Add OAuth login with GitHub provider", state: "OPEN", isDraft: false,
      author: { login: "maya-chen" }, labels: [{ name: "feature", color: "1f6feb" }, { name: "auth", color: "8957e5" }],
      assignees: [{ login: "maya-chen" }, { login: "leo-park" }],
      createdAt: ago(30), updatedAt: ago(2), url: "https://github.com/acme/acme-web/pull/128",
      additions: 412, deletions: 38, changedFiles: 14, headRefName: "feature/login", baseRefName: "main",
      mergeable: "MERGEABLE",
      body: "## Summary\n\nAdds a **Sign in with GitHub** flow so users can authenticate without a password.\n\n## Changes\n\n- New `/auth/github` redirect and callback routes\n- Session cookie issued after a successful token exchange\n- Login page gets a provider button and an error state\n- Unit tests for the callback handler\n\n## Testing\n\n1. Set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`\n2. Run `npm run dev` and open `/login`\n3. Click **Sign in with GitHub**\n\n```\nnpm test -- auth\n```",
      comments: [
        { author: { login: "leo-park" }, createdAt: ago(5), body: "Looks good overall. Can we add a test for the denied-consent path?" },
        { author: { login: "maya-chen" }, createdAt: ago(2), body: "Added in `auth/callback.test.ts`. Ready for another look." },
      ],
      reviews: [{ author: { login: "leo-park" }, state: "COMMENTED" }],
      statusCheckRollup: [
        { name: "build", conclusion: "SUCCESS" }, { name: "lint", conclusion: "SUCCESS" },
        { name: "test", conclusion: "SUCCESS" }, { name: "e2e", conclusion: "SUCCESS" },
      ],
    },
    { number: 127, title: "Fix flaky checkout test on slow CI runners", state: "OPEN", isDraft: false, author: { login: "leo-park" }, updatedAt: ago(4), url: "https://github.com/acme/acme-web/pull/127" },
    { number: 125, title: "Upgrade to Node 22 and refresh lockfile", state: "OPEN", isDraft: false, author: { login: "sam-ortiz" }, updatedAt: ago(9), url: "https://github.com/acme/acme-web/pull/125" },
    { number: 123, title: "Dashboard: lazy-load chart widgets", state: "OPEN", isDraft: true, author: { login: "maya-chen" }, updatedAt: ago(26), url: "https://github.com/acme/acme-web/pull/123" },
    { number: 121, title: "Docs: document environment variables", state: "OPEN", isDraft: false, author: { login: "priya-nair" }, updatedAt: ago(50), url: "https://github.com/acme/acme-web/pull/121" },
    { number: 118, title: "Replace moment.js with date-fns", state: "OPEN", isDraft: false, author: { login: "sam-ortiz" }, updatedAt: ago(96), url: "https://github.com/acme/acme-web/pull/118" },
    { number: 115, title: "Add dark mode toggle to settings", state: "OPEN", isDraft: false, author: { login: "priya-nair" }, updatedAt: ago(170), url: "https://github.com/acme/acme-web/pull/115" },
  ];

  h.set("projects.list", async () => [{ id: "p1", name: "acme-web", path: "/home/dev/acme-web", isActive: true }]);
  h.set("gh.user", async () => ({ login: "maya-chen" }));
  h.set("git.pr.list", async () => prs.map((p) => ({ ...p, author: p.author.login })));
  h.set("exec", async (argv) => {
    const ok = (stdout) => ({ stdout, stderr: "", exitCode: 0 });
    if (argv[1] === "repo") return ok(REPO + "\n");
    if (argv[1] === "pr" && argv[2] === "view") return ok(JSON.stringify(prs.find((p) => String(p.number) === argv[3])));
    if (argv[1] === "pr" && argv[2] === "list") return ok(JSON.stringify(prs));
    if (argv[1] === "issue") return ok("[]");
    return ok("");
  });

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const until = async (test) => { for (let i = 0; i < 100 && !test(); i += 1) await sleep(100); };
  window.addEventListener("load", async () => {
    await until(() => document.querySelector("#search"));
    document.querySelector("[data-mode=prs]").click();
    await until(() => document.querySelector("#search")?.placeholder.includes("pull"));
    await until(() => document.querySelector(".issue"));
    document.querySelector('.issue[data-num="128"]').click();
    await until(() => document.querySelector(".detail__title"));
    await sleep(500);
    window.__ready = true;
  });
})();
