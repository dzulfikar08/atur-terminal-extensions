// Pure helpers: shaping Atur rows for the UI, matching a terminal to its agent
// session, and building the comments Atur expects for claims and evidence.

import { ORIGIN } from "./oauth.js";

export const STATE_LABELS = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In Progress",
  needs_you: "Needs you",
  need_review: "Need Review",
  done: "Done",
  cancelled: "Cancelled",
};

const MAX_EVIDENCE_CHARS = 12_000;
const ANSI_PATTERN = /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007\u001b]*(?:\u0007|\u001b\\)|[@-Z\\-_])/g;

const text = (value) => (typeof value === "string" ? value : "");

export function issueUrl(issue) {
  if (issue.url) return issue.url;
  if (!issue.workspaceSlug || !issue.projectId || !issue.sequenceId) return ORIGIN;
  return `${ORIGIN}/${issue.workspaceSlug}/projects/${issue.projectId}/issues/${issue.sequenceId}`;
}

function sequenceFromKey(key) {
  const match = /-(\d+)$/.exec(text(key));
  return match ? Number(match[1]) : null;
}

/** A row from `my_issues` / `my_today`. */
export function normalizeIssue(row) {
  const sequenceId = row.sequenceId ?? sequenceFromKey(row.key);
  const issue = {
    id: row.id,
    key: row.key || (row.projectIdentifier && sequenceId ? `${row.projectIdentifier}-${sequenceId}` : ""),
    name: text(row.name) || "Untitled",
    sequenceId,
    priority: row.priority || "none",
    projectId: row.projectId,
    projectName: text(row.projectName),
    workspaceSlug: row.workspaceSlug,
    workspaceName: text(row.workspaceName),
    stateKey: row.stateKey || null,
    stateName: row.stateName || STATE_LABELS[row.stateKey] || "",
    stateGroup: row.stateGroup || null,
    targetDate: row.targetDate ? String(row.targetDate).slice(0, 10) : null,
    updatedAt: row.updatedAt || null,
  };
  issue.url = issueUrl(issue);
  return issue;
}

/** The `issue` object inside an agent session (snake_case). */
export function normalizeSessionIssue(issue) {
  if (!issue) return null;
  return {
    id: issue.id,
    key: issue.key,
    name: text(issue.name) || "Untitled",
    sequenceId: sequenceFromKey(issue.key),
    priority: issue.priority || "none",
    projectId: issue.project_id,
    projectName: "",
    workspaceSlug: issue.workspace_slug,
    workspaceName: "",
    stateKey: null,
    stateName: issue.state_name || "",
    stateGroup: issue.state_group || null,
    targetDate: null,
    updatedAt: null,
    url: issue.url || issueUrl({ workspaceSlug: issue.workspace_slug, projectId: issue.project_id, sequenceId: sequenceFromKey(issue.key) }),
  };
}

export function normalizeSession(row) {
  return {
    id: row.id,
    paneId: row.pane_id,
    agent: row.agent || null,
    state: row.state || "unknown",
    stateAt: row.state_at || null,
    updatedAt: row.updated_at || null,
    endedAt: row.ended_at || null,
    cwd: row.cwd || null,
    title: row.title || null,
    issue: normalizeSessionIssue(row.issue),
  };
}

export function normalizeNotification(row) {
  return {
    id: row.id,
    title: text(row.title) || "Notification",
    message: text(row.message),
    issueId: row.issueId || null,
    projectId: row.projectId || null,
    workspaceSlug: row.workspaceSlug || null,
    workspaceName: text(row.workspaceName),
    read: Boolean(row.read),
    createdAt: row.createdAt || null,
  };
}

/** Agents Atur reports as waiting on the user ("blocked") or finished ("done"). */
export function agentGroups(sessions) {
  const live = sessions.filter((s) => !s.endedAt && s.issue);
  const byRecent = (a, b) => (b.stateAt || 0) - (a.stateAt || 0);
  return {
    needsYou: live.filter((s) => s.state === "blocked").sort(byRecent),
    done: live.filter((s) => s.state === "done").sort(byRecent),
  };
}

export function agentStateLabel(state) {
  return { blocked: "Needs you", done: "Done", working: "Working", idle: "Idle" }[state] || "Unknown";
}

const trimSlash = (value) => text(value).replace(/\/+$/, "");

/**
 * The agent session of a terminal pane. Exact when the host reports the server session id;
 * otherwise the live session whose working directory (and, when known, title) matches.
 */
export function matchSession(pane, sessions) {
  if (!pane) return { session: null, ambiguous: 0 };
  const live = sessions.filter((s) => !s.endedAt && s.issue);
  if (pane.sessionID != null) {
    const exact = live.find((s) => String(s.paneId) === String(pane.sessionID) || String(s.paneId).endsWith(`~${pane.sessionID}`));
    return { session: exact || null, ambiguous: 0 };
  }
  const cwd = trimSlash(pane.workingDirectory);
  const title = text(pane.title).trim().toLowerCase();
  const scored = [];
  for (const session of live) {
    let score = 0;
    const sessionCwd = trimSlash(session.cwd);
    if (cwd && sessionCwd && cwd === sessionCwd) score += 2;
    else if (cwd && sessionCwd && (cwd.startsWith(`${sessionCwd}/`) || sessionCwd.startsWith(`${cwd}/`))) score += 1;
    const sessionTitle = text(session.title).trim().toLowerCase();
    if (title && sessionTitle) {
      if (title === sessionTitle) score += 2;
      else if (title.includes(sessionTitle) || sessionTitle.includes(title)) score += 1;
    }
    if (score >= 2) scored.push({ session, score });
  }
  if (!scored.length) return { session: null, ambiguous: 0 };
  scored.sort((a, b) => b.score - a.score || (b.session.updatedAt || 0) - (a.session.updatedAt || 0));
  const best = scored[0].score;
  return { session: scored[0].session, ambiguous: scored.filter((s) => s.score === best).length - 1 };
}

/** Terminal screen text without colour codes, trailing blanks, or runaway length (keeps the tail). */
export function cleanScreen(raw) {
  const lines = text(raw)
    .replace(ANSI_PATTERN, "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""));
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  while (lines.length && lines[0] === "") lines.shift();
  let out = lines.join("\n");
  if (out.length > MAX_EVIDENCE_CHARS) out = `…\n${out.slice(out.length - MAX_EVIDENCE_CHARS)}`;
  return out;
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}

/** The comment posted when moving an issue to Need Review. */
export function evidenceHtml({ summary = "", output = "", source = "" }) {
  const parts = [];
  const note = text(summary).trim();
  parts.push(`<p><strong>Ready for review.</strong>${note ? ` ${escapeHtml(note)}` : ""}</p>`);
  const body = cleanScreen(output);
  if (body) {
    parts.push(`<p>Evidence${source ? ` (${escapeHtml(source)})` : ""}:</p>`);
    parts.push(`<pre><code>${escapeHtml(body)}</code></pre>`);
  }
  return parts.join("");
}

/** Matches AGENTS.md ("Picked up by <agent> (pane <id>)"), which Atur parses to link the terminal. */
export function claimComment({ agent, paneId }) {
  const who = escapeHtml(text(agent).trim() || "Atur Terminal");
  return paneId ? `<p>Picked up by ${who} (pane ${escapeHtml(paneId)}).</p>` : `<p>Picked up by ${who} (Atur Terminal).</p>`;
}

export function findState(states, key) {
  return states.find((s) => s.key === key) || null;
}

export function timeAgo(value, now = Date.now()) {
  const then = typeof value === "number" ? value : Date.parse(value);
  if (!Number.isFinite(then)) return "";
  const seconds = Math.max(0, Math.floor((now - then) / 1000));
  if (seconds < 45) return "just now";
  const units = [[60, "m"], [24, "h"], [30, "d"], [12, "mo"], [Infinity, "y"]];
  let amount = Math.floor(seconds / 60) || 1;
  for (const [step, label] of units) {
    if (amount < step) return `${amount}${label} ago`;
    amount = Math.floor(amount / step);
  }
  return "";
}

export function dueLabel(date, today = new Date().toISOString().slice(0, 10)) {
  if (!date) return "";
  if (date < today) return `Overdue · ${date.slice(5)}`;
  if (date === today) return "Due today";
  return `Due ${date.slice(5)}`;
}

export function initials(name) {
  const parts = text(name).trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || "?").toUpperCase() + (parts[1]?.[0] || "").toUpperCase();
}
