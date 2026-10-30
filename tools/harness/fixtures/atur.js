// Sample Atur account for the atur extension: signed in with an API key, and an MCP
// endpoint (POST https://app.diatur.com/mcp) served from memory through atur.http.fetch.
(() => {
  const h = window.__harness;
  const iso = (hours) => new Date(Date.now() - hours * 3600 * 1000).toISOString();
  const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
  const logo = (letter, shade) =>
    "data:image/svg+xml;base64," +
    btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="${shade}"/><text x="16" y="22" font-family="sans-serif" font-size="17" font-weight="700" text-anchor="middle" fill="#f2f2f2">${letter}</text></svg>`);

  const workspaces = [
    { id: "w1", name: "Atur", slug: "atur", logo: "/api/assets/a1", dataUrl: logo("A", "#3a3a3a") },
    { id: "w2", name: "Joyo Digitama", slug: "joyo", logo: "/api/assets/a2", dataUrl: logo("J", "#4a4a4a") },
    { id: "w3", name: "Waqtu", slug: "waqtu", logo: "/api/assets/a3", dataUrl: logo("W", "#2e2e2e") },
  ];
  const states = [
    { id: "st-back", name: "Backlog", key: "backlog", groupName: "backlog" },
    { id: "st-todo", name: "Todo", key: "todo", groupName: "unstarted" },
    { id: "st-ip", name: "In Progress", key: "in_progress", groupName: "started" },
    { id: "st-ny", name: "Needs you", key: "needs_you", groupName: "started" },
    { id: "st-nr", name: "Need Review", key: "need_review", groupName: "started" },
    { id: "st-done", name: "Done", key: "done", groupName: "completed" },
  ];
  const row = (id, key, name, stateKey, ws, extra = {}) => ({
    id, key, name, sequenceId: Number(key.split("-")[1]), priority: "medium", stateKey,
    stateName: states.find((s) => s.key === stateKey).name, stateGroup: "started",
    projectId: "p-" + ws.slug, projectName: ws.slug === "atur" ? "Terminal" : "Operations", projectIdentifier: key.split("-")[0],
    workspaceSlug: ws.slug, workspaceName: ws.name, targetDate: null, updatedAt: iso(3), ...extra,
  });
  const [atur, joyo, waqtu] = workspaces;
  const issues = [
    row("i-12", "ATUR-12", "Atur panels extension for Atur Terminal", "in_progress", atur),
    row("i-31", "ATUR-31", "Pane to issue links for agent sessions", "needs_you", atur),
    row("i-27", "ATUR-27", "Phone: scroll gesture on terminal panes", "need_review", atur, { targetDate: day(1) }),
    row("i-8", "JOYO-8", "Quarterly invoice export for the pondok", "todo", joyo, { targetDate: day(-2) }),
    row("i-44", "WAQ-44", "Prayer time notifications drift after DST", "in_progress", waqtu),
    row("i-19", "ATUR-19", "Store listing screenshots from the CI harness", "todo", atur),
  ];
  const sessions = [
    { id: "s1", paneId: "77", agent: "omp", state: "working", stateAt: Date.now() - 600000, updatedAt: Date.now() - 60000, endedAt: null, cwd: "/home/dev/atur", title: "omp", issue: { id: "i-12", key: "ATUR-12", name: issues[0].name, projectId: "p-atur", workspaceSlug: "atur", stateName: "In Progress", stateGroup: "started", priority: "medium", url: "https://app.diatur.com/atur/projects/p-atur/issues/12" } },
    { id: "s2", paneId: "78", agent: "claude", state: "blocked", stateAt: Date.now() - 300000, updatedAt: Date.now() - 300000, endedAt: null, cwd: "/home/dev/waqtu", title: "claude", issue: { id: "i-44", key: "WAQ-44", name: issues[4].name, projectId: "p-waqtu", workspaceSlug: "waqtu", stateName: "In Progress", stateGroup: "started", priority: "high", url: "https://app.diatur.com/waqtu/projects/p-waqtu/issues/44" } },
    { id: "s3", paneId: "79", agent: "omp", state: "done", stateAt: Date.now() - 1200000, updatedAt: Date.now() - 1200000, endedAt: null, cwd: "/home/dev/atur-wt", title: "omp", issue: { id: "i-27", key: "ATUR-27", name: issues[2].name, projectId: "p-atur", workspaceSlug: "atur", stateName: "Need Review", stateGroup: "started", priority: "medium", url: "https://app.diatur.com/atur/projects/p-atur/issues/27" } },
  ];
  const notifications = [
    { id: "n1", title: "Maya commented on ATUR-12: Atur panels extension", message: "Can we show the linked issue first?", issueId: "i-12", projectId: "p-atur", workspaceSlug: "atur", workspaceName: "Atur", read: false, createdAt: iso(1) },
    { id: "n2", title: "You were assigned ATUR-31", message: "", issueId: "i-31", projectId: "p-atur", workspaceSlug: "atur", workspaceName: "Atur", read: false, createdAt: iso(5) },
    { id: "n3", title: "Leo moved JOYO-8 to Todo", message: "", issueId: "i-8", projectId: "p-joyo", workspaceSlug: "joyo", workspaceName: "Joyo Digitama", read: true, createdAt: iso(30) },
  ];
  const comments = [
    { id: "c1", actorId: "u1", commentHtml: "<p>Picked up by omp (pane 77).</p>", createdAt: iso(4) },
    { id: "c2", actorId: "u2", commentHtml: "<p>Can we show the <strong>linked issue</strong> first, above the lists?</p>", createdAt: iso(1) },
  ];
  const inWs = (list, args) => list.filter((i) => !args.workspace || i.workspaceSlug === args.workspace);
  const today = (args) => {
    const rows = inWs(issues, args);
    const pick = (fn) => rows.filter(fn);
    return {
      overdue: pick((i) => i.targetDate && i.targetDate < day(0)),
      due_today: [], needs_you: pick((i) => i.stateKey === "needs_you"),
      need_review: pick((i) => i.stateKey === "need_review"), in_progress: pick((i) => i.stateKey === "in_progress"),
      due_this_week: [], counts: { total: rows.length },
    };
  };

  const tools = {
    whoami: () => ({ id: "u1", email: "maya@example.com", displayName: "Maya Chen", avatar: null }),
    list_workspaces: () => workspaces.map(({ id, name, slug, logo: l }) => ({ id, name, slug, logo: l })),
    get_workspace_logo: ({ workspace }) => ({ contentType: "image/svg+xml", dataUrl: workspaces.find((w) => w.slug === workspace)?.dataUrl || null }),
    my_issues: (args) => {
      const rows = inWs(issues, args).filter((i) => !args.state_key || args.state_key.split(",").includes(i.stateKey));
      return { results: rows, total: rows.length };
    },
    my_today: today,
    list_notifications: () => ({ results: notifications, total: notifications.length, unread: notifications.filter((n) => !n.read).length }),
    mark_notification_read: () => ({ ok: true }),
    list_agent_sessions: (args) => ({ sessions: sessions.filter((s) => !args.workspace || s.issue.workspaceSlug === args.workspace) }),
    get_session_issue: ({ pane_id }) => ({ session: sessions.find((s) => s.pane_id === pane_id) || null }),
    list_states: () => states,
    get_issue: ({ issue_id }) => ({ id: issue_id, descriptionHtml: "<p>Bring Atur into the terminal: your issues, the inbox, today and the agents that need you, next to the work.</p><ul><li>Sidebar panel and a tab view</li><li>Claim, comment, change state</li><li>Mark Need Review with terminal output as evidence</li></ul>" }),
    list_comments: () => comments,
    update_issue: () => ({ ok: true }),
    add_comment: () => ({ ok: true }),
    set_assignee: () => ({ ok: true }),
  };

  h.memory.set("auth", { kind: "apikey", apiKey: "pk_live_" + "a".repeat(32), signedInAt: Date.now() });
  h.set("http.fetch", async (url, options = {}) => {
    const body = JSON.parse(options.body || "{}");
    const run = tools[body.params?.name];
    if (!run) return { status: 400, headers: {}, body: JSON.stringify({ jsonrpc: "2.0", id: body.id, error: { code: -32000, message: "Unknown tool: " + body.params?.name } }) };
    return { status: 200, headers: {}, body: JSON.stringify({ jsonrpc: "2.0", id: body.id, result: { content: [{ type: "text", text: JSON.stringify(run(body.params.arguments || {})) }] } }) };
  });
  h.set("panes.list", async () => [
    { id: "pane-a", title: "omp", workingDirectory: "/home/dev/atur", isFocused: true },
    { id: "pane-b", title: "zsh", workingDirectory: "/home/dev/waqtu", isFocused: false },
  ]);
  h.set("panes.readScreen", async () => "\u001b[32m$ bun test apps/extensions\u001b[0m\n 61 pass\n 0 fail\nRan 61 tests across 7 files. [412ms]\n\n$ npm run build\n✓ built in 380ms\n");

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  h.until = async (test, tries = 150) => { for (let i = 0; i < tries && !test(); i += 1) await sleep(100); return test(); };
  h.sleep = sleep;
})();
