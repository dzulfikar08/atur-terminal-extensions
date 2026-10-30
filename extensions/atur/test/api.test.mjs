import { test } from "node:test";
import assert from "node:assert/strict";
import { createApi } from "../src/lib/api.js";

function fakeMcp(handlers) {
  const calls = [];
  return {
    calls,
    async call(name, args) {
      calls.push([name, args]);
      const handler = handlers[name];
      if (!handler) throw new Error(`Unknown tool: ${name}`);
      return handler(args);
    },
  };
}

const issue = { id: "i1", projectId: "p1", workspaceSlug: "atur", key: "ATUR-1", name: "x" };
const STATES = { results: [{ id: "s-ip", name: "In Progress", key: "in_progress", groupName: "started" }, { id: "s-nr", name: "Need Review", key: "need_review", groupName: "started" }] };

test("my issues are scoped by workspace and filtered by state key", async () => {
  const mcp = fakeMcp({ my_issues: () => ({ results: [{ id: "i1", name: "A", sequenceId: 3, projectIdentifier: "ATUR", projectId: "p1", workspaceSlug: "atur" }], total: 9 }) });
  const result = await createApi({ mcp }).myIssues({ workspace: "atur", stateKeys: ["todo", "in_progress"] });
  assert.deepEqual(mcp.calls[0], ["my_issues", { workspace: "atur", state_key: "todo,in_progress", limit: 50 }]);
  assert.equal(result.total, 9);
  assert.equal(result.items[0].key, "ATUR-3");
  await createApi({ mcp }).myIssues({ workspace: "all" });
  assert.equal("workspace" in mcp.calls[1][1], false);
});

test("today maps every bucket", async () => {
  const row = { id: "i", name: "n", sequenceId: 1, projectIdentifier: "P" };
  const mcp = fakeMcp({ my_today: () => ({ overdue: [row], due_today: [row, row], needs_you: [], need_review: [row], in_progress: [], due_this_week: [], counts: { total: 4 } }) });
  const today = await createApi({ mcp }).today({ today: "2026-10-30" });
  assert.deepEqual(mcp.calls[0][1], { today: "2026-10-30" });
  assert.deepEqual([today.overdue.length, today.dueToday.length, today.needReview.length, today.total], [1, 2, 1, 4]);
});

test("agent sessions come back grouped", async () => {
  const mcp = fakeMcp({
    list_agent_sessions: () => ({ sessions: [{ id: "s", paneId: "1", state: "blocked", stateAt: 1, issue: { id: "i", key: "A-1", name: "n", projectId: "p", workspaceSlug: "w" } }] }),
  });
  const result = await createApi({ mcp }).agentSessions({ workspace: "w" });
  assert.deepEqual(mcp.calls[0], ["list_agent_sessions", { workspace: "w", active: true, limit: 100 }]);
  assert.equal(result.needsYou.length, 1);
});

test("a pane's session is looked up by its id; none is null", async () => {
  const api = createApi({ mcp: fakeMcp({ get_session_issue: ({ pane_id }) => (pane_id === "77" ? { session: { id: "s", paneId: "77", issue: null } } : { session: null }) }) });
  assert.equal((await api.sessionForPane(77)).paneId, "77");
  assert.equal(await api.sessionForPane("78"), null);
});

test("claim assigns me, leaves the claim comment, then moves to In Progress", async () => {
  const mcp = fakeMcp({ whoami: () => ({ id: "u1", displayName: "Dzul" }), set_assignee: () => ({}), add_comment: () => ({}), list_states: () => STATES, update_issue: () => ({}) });
  const state = await createApi({ mcp }).claim(issue, { agent: "omp", paneId: "77" });
  assert.deepEqual(mcp.calls.map((c) => c[0]), ["whoami", "set_assignee", "add_comment", "list_states", "update_issue"]);
  assert.equal(mcp.calls[1][1].assignee_id, "u1");
  assert.equal(mcp.calls[2][1].comment_html, "<p>Picked up by omp (pane 77).</p>");
  assert.equal(mcp.calls[4][1].state_id, "s-ip");
  assert.equal(state.key, "in_progress");
});

test("claim without an agent names the user and the terminal", async () => {
  const mcp = fakeMcp({ whoami: () => ({ id: "u1", displayName: "Dzul" }), set_assignee: () => ({}), add_comment: () => ({}), list_states: () => STATES, update_issue: () => ({}) });
  await createApi({ mcp }).claim(issue);
  assert.equal(mcp.calls[2][1].comment_html, "<p>Picked up by Dzul (Atur Terminal).</p>");
});

test("Need Review posts the evidence first and only then changes the state", async () => {
  const mcp = fakeMcp({ add_comment: () => ({}), list_states: () => STATES, update_issue: () => ({}) });
  await createApi({ mcp }).needReview(issue, { summary: "done", output: "all green", source: "terminal" });
  assert.deepEqual(mcp.calls.map((c) => c[0]), ["add_comment", "list_states", "update_issue"]);
  assert.match(mcp.calls[0][1].comment_html, /all green/);
  assert.equal(mcp.calls[2][1].state_id, "s-nr");
});

test("a failed evidence comment leaves the state alone", async () => {
  const mcp = fakeMcp({ add_comment: () => { throw new Error("forbidden"); }, update_issue: () => ({}) });
  await assert.rejects(createApi({ mcp }).needReview(issue, { summary: "x", output: "" }), /forbidden/);
  assert.equal(mcp.calls.some((c) => c[0] === "update_issue"), false);
});

test("a project without the state gets a clear error and no update", async () => {
  const mcp = fakeMcp({ add_comment: () => ({}), list_states: () => ({ results: [{ id: "s", name: "Todo", key: "todo" }] }), update_issue: () => ({}) });
  await assert.rejects(createApi({ mcp }).needReview(issue, { summary: "x", output: "" }), /no "need_review" state/);
  assert.equal(mcp.calls.some((c) => c[0] === "update_issue"), false);
});

test("states are cached per project and detail merges the issue with its comments oldest first", async () => {
  const mcp = fakeMcp({
    list_states: () => STATES,
    get_issue: () => ({ descriptionHtml: "<p>d</p>" }),
    list_comments: () => [{ id: "c2", commentHtml: "b", createdAt: "2026-10-30" }, { id: "c1", commentHtml: "a", createdAt: "2026-10-29" }],
  });
  const api = createApi({ mcp });
  await api.states(issue);
  await api.states(issue);
  assert.equal(mcp.calls.filter((c) => c[0] === "list_states").length, 1);
  const detail = await api.detail(issue);
  assert.deepEqual(detail.comments.map((c) => c.id), ["c1", "c2"]);
  assert.equal(detail.descriptionHtml, "<p>d</p>");
  assert.equal(mcp.calls.find((c) => c[0] === "get_issue")[1].slim, false);
});

test("workspace logos are cached and a missing tool just means no logo", async () => {
  let n = 0;
  const api = createApi({ mcp: fakeMcp({ get_workspace_logo: () => (++n, { dataUrl: "data:image/png;base64,AAAA" }) }) });
  assert.equal(await api.workspaceLogo("atur"), "data:image/png;base64,AAAA");
  await api.workspaceLogo("atur");
  assert.equal(n, 1);
  assert.equal(await createApi({ mcp: fakeMcp({}) }).workspaceLogo("x"), null);
});

test("workspaces and notifications are normalised", async () => {
  const mcp = fakeMcp({
    list_workspaces: () => [{ id: "w1", name: "Atur", slug: "atur", logo: "/api/assets/1" }],
    list_notifications: () => ({ results: [{ id: "n1", title: "t", read: false }], unread: 4 }),
  });
  const api = createApi({ mcp });
  assert.deepEqual(await api.workspaces(), [{ id: "w1", name: "Atur", slug: "atur", logo: "/api/assets/1" }]);
  const inbox = await api.notifications();
  assert.deepEqual([inbox.items.length, inbox.unread], [1, 4]);
});
