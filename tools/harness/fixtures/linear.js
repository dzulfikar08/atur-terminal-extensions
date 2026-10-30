// Sample Linear workspace for the linear extension: GraphQL answered through atur.http.fetch,
// a linked project in .linear.json, and the current git branch.
(() => {
  const h = window.__harness;
  const ago = (hours) => new Date(Date.now() - hours * 3600 * 1000).toISOString();

  const TEAM = { id: "team-acm", key: "ACM", name: "Acme" };
  const PROJECT = { id: "proj-web", name: "acme-web" };
  const ME = { id: "u-maya", name: "Maya Chen", displayName: "maya", avatarUrl: null };
  const LEO = { id: "u-leo", name: "Leo Park", displayName: "leo", avatarUrl: null };
  const PRIYA = { id: "u-priya", name: "Priya Nair", displayName: "priya", avatarUrl: null };

  const STATES = [
    { id: "st-backlog", name: "Backlog", type: "backlog", color: "#bec2c8", position: 0 },
    { id: "st-todo", name: "Todo", type: "unstarted", color: "#e2e2e2", position: 1 },
    { id: "st-progress", name: "In Progress", type: "started", color: "#f2c94c", position: 2 },
    { id: "st-review", name: "In Review", type: "started", color: "#5e6ad2", position: 3 },
    { id: "st-done", name: "Done", type: "completed", color: "#4cb782", position: 4 },
    { id: "st-canceled", name: "Canceled", type: "canceled", color: "#95a2b3", position: 5 },
  ];
  const state = (id) => { const s = STATES.find((x) => x.id === id); return { id: s.id, name: s.name, type: s.type, color: s.color }; };

  const LABELS = [
    { id: "lb-feature", name: "Feature", color: "#5e6ad2", isGroup: false },
    { id: "lb-bug", name: "Bug", color: "#eb5757", isGroup: false },
    { id: "lb-perf", name: "Performance", color: "#f2994a", isGroup: false },
    { id: "lb-docs", name: "Docs", color: "#4cb782", isGroup: false },
    { id: "lb-chore", name: "Chore", color: "#95a2b3", isGroup: false },
    { id: "lb-security", name: "Security", color: "#bb87fc", isGroup: false },
  ];
  const label = (id) => { const l = LABELS.find((x) => x.id === id); return { id: l.id, name: l.name, color: l.color }; };

  let seq = 0;
  const make = (num, title, stateId, priority, hours, opts = {}) => ({
    id: "iss-" + num,
    identifier: "ACM-" + num,
    title,
    url: "https://linear.app/acme/issue/ACM-" + num,
    branchName: "feature/acm-" + num,
    priority,
    updatedAt: ago(hours),
    createdAt: ago(hours + 48 + (seq += 1)),
    state: state(stateId),
    team: TEAM,
    project: PROJECT,
    projectMilestone: opts.milestone ? { id: "ms-" + opts.milestone, name: opts.milestone } : null,
    labels: { nodes: (opts.labels || []).map(label) },
    assignee: opts.assignee === undefined ? ME : opts.assignee,
    parent: opts.parent || null,
    children: { nodes: (opts.kids || []).map((t) => ({ state: { type: t } })) },
  });

  const parent142 = { id: "iss-142", identifier: "ACM-142", title: "Add OAuth login with GitHub provider" };
  const issues = [
    make(142, "Add OAuth login with GitHub provider", "st-progress", 2, 1, { milestone: "Beta launch", labels: ["lb-feature"], kids: ["completed", "completed", "started", "unstarted"] }),
    make(139, "Fix flaky checkout test on slow CI runners", "st-progress", 3, 5, { labels: ["lb-bug"] }),
    make(143, "Handle the denied-consent path", "st-progress", 3, 3, { parent: parent142, labels: ["lb-feature"] }),
    make(151, "Dashboard: lazy-load chart widgets", "st-review", 3, 9, { milestone: "Beta launch", labels: ["lb-perf"], assignee: LEO }),
    make(148, "Upgrade to Node 22 and refresh lockfile", "st-todo", 4, 26, { labels: ["lb-chore"] }),
    make(146, "Document environment variables in the README", "st-todo", 4, 50, { labels: ["lb-docs"], assignee: PRIYA }),
    make(144, "Replace moment.js with date-fns", "st-todo", 3, 74, { labels: ["lb-chore"] }),
    make(137, "Add dark mode toggle to settings", "st-backlog", 0, 120, { labels: ["lb-feature"] }),
    make(133, "Rate-limit the public search endpoint", "st-backlog", 2, 170, { labels: ["lb-security"], assignee: null }),
    make(128, "Dashboard empty-state illustration", "st-done", 4, 200, { labels: ["lb-feature"], assignee: PRIYA }),
  ];
  const byId = (id) => issues.find((i) => i.id === id || i.identifier === id);

  const detailFor = (issue) => {
    const kids = [
      { ...make(143, "Handle the denied-consent path", "st-progress", 3, 3, { parent: parent142 }), createdAt: ago(60) },
      { ...make(152, "Add the GitHub provider button to the login page", "st-done", 3, 20, { parent: parent142 }), createdAt: ago(70) },
      { ...make(153, "Store OAuth tokens encrypted at rest", "st-done", 2, 18, { parent: parent142 }), createdAt: ago(69) },
      { ...make(154, "Write end-to-end test for the sign-in flow", "st-todo", 3, 12, { parent: parent142 }), createdAt: ago(68) },
    ];
    return {
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      description: issue.id === "iss-142"
        ? "## Summary\n\nLet users **sign in with GitHub** instead of creating a password.\n\n## Acceptance criteria\n\n- [x] `/auth/github` redirects to the provider and back\n- [x] New users get an account on first sign-in\n- [ ] Denied consent shows a friendly error\n- [ ] Session cookie rotates on every sign-in\n\nSee the design notes in the team wiki for the error copy."
        : "",
      url: issue.url,
      priority: issue.priority,
      assignee: issue.assignee,
      project: issue.project,
      labels: issue.labels,
      comments: {
        nodes: issue.id === "iss-142"
          ? [
              { id: "c1", body: "Started on the callback route. The provider returns the email only when the `user:email` scope is granted, so I am requesting it explicitly.", createdAt: ago(30), user: ME },
              { id: "c2", body: "Looks good. Can we also cover the **denied-consent** path with a test?", createdAt: ago(5), user: LEO },
              { id: "c3", body: "Added `auth/callback.test.ts`; opening the pull request for review today.", createdAt: ago(2), user: ME },
            ]
          : [],
      },
      children: { nodes: issue.id === "iss-142" ? kids : [] },
    };
  };

  // Seed the extension's own settings: a registered API key and the linked project.
  h.memory.set("api_tokens", [{ id: "k1", label: "Acme", token: "lin_api_SAMPLE" }]);
  h.memory.set("api_token_active", "k1");
  h.memory.set("language", "en");
  h.set("projects.list", async () => [{ id: "p1", name: "acme-web", path: "/home/dev/acme-web", isActive: true }]);
  h.set("files.read", async (path) => {
    if (path === ".linear.json") return { content: JSON.stringify({ teamKey: "ACM", projectId: PROJECT.id, projectName: PROJECT.name }) };
    throw new Error("not found");
  });
  h.set("git.repoInfo", async () => ({ currentBranch: "feature/ACM-142-oauth-login", isWorktree: false, root: "/home/dev/acme-web" }));

  const reply = (data) => ({ status: 200, headers: {}, body: JSON.stringify({ data }) });
  h.set("http.fetch", async (_url, init) => {
    const { query, variables } = JSON.parse(init.body);
    if (query.includes("MyIssues")) return reply({ viewer: { ...ME, assignedIssues: { nodes: issues } } });
    if (query.includes("ProjectIssues")) return reply({ project: { ...PROJECT, issues: { nodes: issues } } });
    if (query.includes("workflowStates")) return reply({ workflowStates: { nodes: STATES } });
    if (query.includes("TeamStates")) return reply({ team: { ...TEAM, states: { nodes: STATES } } });
    if (query.includes("TeamMembers")) return reply({ team: { ...TEAM, members: { nodes: [ME, LEO, PRIYA].map((u) => ({ ...u, active: true })) } } });
    if (query.includes("TeamProjects")) return reply({ team: { ...TEAM, projects: { nodes: [{ ...PROJECT, state: "started" }, { id: "proj-mobile", name: "acme-mobile", state: "started" }] } } });
    if (query.includes("TeamLabels")) return reply({ team: { ...TEAM, labels: { nodes: LABELS } } });
    if (query.includes("IssueDetail")) return reply({ issue: detailFor(byId(variables.id)) });
    if (query.includes("TeamByKey")) return reply({ teams: { nodes: [TEAM] } });
    return reply({});
  });

  // Case 2 opens the issue tab for ACM-142, as the panel does on a click.
  const wanted = window.__harness.data && window.__harness.data.issueId;
  if (wanted) {
    window.__harness.base.data = { issue: byId(wanted), config: { api_token: "lin_api_SAMPLE", language: "en" }, mode: "tab" };
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const until = async (test) => { for (let i = 0; i < 150 && !test(); i += 1) await sleep(100); };
  window.addEventListener("load", async () => {
    if (wanted) {
      await until(() => document.querySelectorAll(".sub-issue").length >= 4 && document.querySelectorAll(".comment").length >= 3);
    } else {
      await until(() => document.querySelectorAll(".issue").length >= issues.length);
    }
    await sleep(800);
    window.__ready = true;
  });
})();
