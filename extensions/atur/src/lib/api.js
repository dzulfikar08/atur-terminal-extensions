// What the UI asks of Atur, expressed as MCP tool calls. `mcp.call(name, args)` is
// injected so tests can stand in for the server.

import {
  agentGroups,
  claimComment,
  evidenceHtml,
  findState,
  normalizeIssue,
  normalizeNotification,
  normalizeSession,
} from "./model.js";

const arrayOf = (value, key) => (Array.isArray(value) ? value : Array.isArray(value?.[key]) ? value[key] : []);
const scope = (workspace) => (workspace && workspace !== "all" ? { workspace } : {});

export function createApi({ mcp }) {
  let me = null;
  const stateCache = new Map();
  const logoCache = new Map();

  const api = {
    async whoami() {
      if (!me) me = await mcp.call("whoami", {});
      return me;
    },

    async workspaces() {
      const rows = arrayOf(await mcp.call("list_workspaces", {}), "results");
      return rows.map((row) => ({ id: row.id, name: row.name, slug: row.slug, logo: row.logo || null }));
    },

    /** A workspace logo as a data URL (the asset route needs a session cookie a page cannot send). */
    async workspaceLogo(slug) {
      if (logoCache.has(slug)) return logoCache.get(slug);
      const result = await mcp.call("get_workspace_logo", { workspace: slug }).catch(() => null);
      const url = result?.dataUrl || null;
      logoCache.set(slug, url);
      return url;
    },

    async myIssues({ workspace, stateKeys, due, limit = 50 } = {}) {
      const result = await mcp.call("my_issues", {
        ...scope(workspace),
        ...(stateKeys?.length ? { state_key: stateKeys.join(",") } : {}),
        ...(due ? { due } : {}),
        limit,
      });
      return { items: arrayOf(result, "results").map(normalizeIssue), total: result?.total ?? 0 };
    },

    async today({ workspace, today } = {}) {
      const result = await mcp.call("my_today", { ...scope(workspace), ...(today ? { today } : {}) });
      const bucket = (key) => arrayOf(result, key).map(normalizeIssue);
      return {
        overdue: bucket("overdue"),
        dueToday: bucket("due_today"),
        needsYou: bucket("needs_you"),
        needReview: bucket("need_review"),
        inProgress: bucket("in_progress"),
        dueThisWeek: bucket("due_this_week"),
        total: result?.counts?.total ?? 0,
      };
    },

    async notifications() {
      const result = await mcp.call("list_notifications", { limit: 40 });
      return { items: arrayOf(result, "results").map(normalizeNotification), unread: result?.unread ?? 0 };
    },

    markNotificationRead: (id) => mcp.call("mark_notification_read", { id }),

    async agentSessions({ workspace } = {}) {
      const result = await mcp.call("list_agent_sessions", { ...scope(workspace), active: true, limit: 100 });
      const sessions = arrayOf(result, "sessions").map(normalizeSession);
      return { sessions, ...agentGroups(sessions) };
    },

    async sessionForPane(paneId) {
      const result = await mcp.call("get_session_issue", { pane_id: String(paneId) });
      return result?.session ? normalizeSession(result.session) : null;
    },

    async detail(issue) {
      const [full, comments] = await Promise.all([
        mcp.call("get_issue", { workspace: issue.workspaceSlug, project_id: issue.projectId, issue_id: issue.id, slim: false }),
        mcp.call("list_comments", { workspace: issue.workspaceSlug, project_id: issue.projectId, issue_id: issue.id, slim: false }),
      ]);
      return {
        descriptionHtml: full?.descriptionHtml || "",
        comments: arrayOf(comments, "results")
          .map((row) => ({ id: row.id, actorId: row.actorId, html: row.commentHtml || "", createdAt: row.createdAt }))
          .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))),
      };
    },

    async states(issue) {
      const key = `${issue.workspaceSlug}/${issue.projectId}`;
      if (!stateCache.has(key)) {
        const rows = arrayOf(await mcp.call("list_states", { workspace: issue.workspaceSlug, project_id: issue.projectId }), "results");
        stateCache.set(key, rows.map((s) => ({ id: s.id, name: s.name, key: s.key || null, group: s.groupName || null })));
      }
      return stateCache.get(key);
    },

    async setState(issue, stateId) {
      await mcp.call("update_issue", { workspace: issue.workspaceSlug, project_id: issue.projectId, issue_id: issue.id, state_id: stateId });
    },

    async setStateByKey(issue, key) {
      const state = findState(await api.states(issue), key);
      if (!state) throw new Error(`This project has no "${key}" state.`);
      await api.setState(issue, state.id);
      return state;
    },

    async comment(issue, html) {
      await mcp.call("add_comment", { workspace: issue.workspaceSlug, project_id: issue.projectId, issue_id: issue.id, comment_html: html });
    },

    /** Assign to me, leave the claim comment Atur recognises, and move to In Progress. */
    async claim(issue, { agent, paneId } = {}) {
      const user = await api.whoami();
      await mcp.call("set_assignee", { workspace: issue.workspaceSlug, project_id: issue.projectId, issue_id: issue.id, assignee_id: user.id });
      await api.comment(issue, claimComment({ agent: agent || user.displayName, paneId }));
      return api.setStateByKey(issue, "in_progress");
    },

    /** Evidence comment first, then the state change: a failed comment must not leave a bare Need Review. */
    async needReview(issue, { summary, output, source }) {
      await api.comment(issue, evidenceHtml({ summary, output, source }));
      return api.setStateByKey(issue, "need_review");
    },
  };
  return api;
}
