import { test } from "node:test";
import assert from "node:assert/strict";
import {
  agentGroups, claimComment, cleanScreen, dueLabel, evidenceHtml, findState, initials, issueUrl,
  matchSession, normalizeIssue, normalizeNotification, normalizeSession, timeAgo,
} from "../src/lib/model.js";

const sessionRow = (over = {}) => ({
  id: "s1", paneId: "77", agent: "omp", state: "working", stateAt: 100, updatedAt: 100, endedAt: null,
  cwd: "/home/dev/atur", title: "omp", issue: { id: "i1", key: "ATUR-12", name: "Panels", projectId: "p1", workspaceSlug: "atur", stateKey: "in_progress", stateName: "In Progress", stateGroup: "started", priority: "high", url: "https://app.diatur.com/atur/projects/p1/issues/12" },
  ...over,
});

test("my_issues rows become UI issues with a key, state label and web address", () => {
  const issue = normalizeIssue({ id: "i1", name: "Fix it", sequenceId: 7, projectIdentifier: "ATUR", projectId: "p1", workspaceSlug: "atur", workspaceName: "Atur", stateKey: "needs_you", targetDate: "2026-11-02T00:00:00Z" });
  assert.equal(issue.key, "ATUR-7");
  assert.equal(issue.stateName, "Needs you");
  assert.equal(issue.targetDate, "2026-11-02");
  assert.equal(issue.url, "https://app.diatur.com/atur/projects/p1/issues/7");
  assert.equal(issueUrl({}), "https://app.diatur.com");
});

test("session rows keep the issue link and its state", () => {
  const session = normalizeSession(sessionRow());
  assert.equal(session.issue.projectId, "p1");
  assert.equal(session.issue.sequenceId, 12);
  assert.equal(session.issue.url, "https://app.diatur.com/atur/projects/p1/issues/12");
  assert.equal(normalizeSession(sessionRow({ issue: null })).issue, null);
});

test("notifications keep read state and the issue they point to", () => {
  const n = normalizeNotification({ id: "n1", title: "Maya commented", issueId: "i1", projectId: "p1", workspaceSlug: "atur", read: false });
  assert.deepEqual([n.read, n.issueId, n.workspaceSlug], [false, "i1", "atur"]);
});

test("agents are grouped into Needs you (blocked) and Done, newest first, skipping ended or unlinked sessions", () => {
  const sessions = [
    normalizeSession(sessionRow({ id: "a", state: "blocked", stateAt: 1 })),
    normalizeSession(sessionRow({ id: "b", state: "blocked", stateAt: 9 })),
    normalizeSession(sessionRow({ id: "c", state: "done" })),
    normalizeSession(sessionRow({ id: "d", state: "blocked", endedAt: 5 })),
    normalizeSession(sessionRow({ id: "e", state: "blocked", issue: null })),
    normalizeSession(sessionRow({ id: "f", state: "working" })),
  ];
  const groups = agentGroups(sessions);
  assert.deepEqual(groups.needsYou.map((s) => s.id), ["b", "a"]);
  assert.deepEqual(groups.done.map((s) => s.id), ["c"]);
});

test("a pane with a session id matches exactly, including relay-prefixed ids", () => {
  const sessions = [normalizeSession(sessionRow({ paneId: "mbp~77" })), normalizeSession(sessionRow({ id: "s2", paneId: "78" }))];
  assert.equal(matchSession({ sessionID: "77" }, sessions).session.id, "s1");
  assert.equal(matchSession({ sessionID: "79" }, sessions).session, null);
});

test("without a session id the working directory (and title) decide", () => {
  const sessions = [
    normalizeSession(sessionRow({ id: "a", cwd: "/home/dev/atur", title: "omp", updatedAt: 1 })),
    normalizeSession(sessionRow({ id: "b", cwd: "/home/dev/other", title: "omp" })),
  ];
  assert.equal(matchSession({ workingDirectory: "/home/dev/atur/", title: "build" }, sessions).session.id, "a");
  assert.equal(matchSession({ workingDirectory: "/tmp", title: "x" }, sessions).session, null);
  assert.equal(matchSession(null, sessions).session, null);
});

test("two sessions in one folder: the title breaks the tie, otherwise the newest wins and ambiguity is reported", () => {
  const sessions = [
    normalizeSession(sessionRow({ id: "a", title: "omp: ATUR-12", updatedAt: 1 })),
    normalizeSession(sessionRow({ id: "b", title: "omp: ATUR-13", updatedAt: 9 })),
  ];
  const byTitle = matchSession({ workingDirectory: "/home/dev/atur", title: "omp: ATUR-12" }, sessions);
  assert.equal(byTitle.session.id, "a");
  assert.equal(byTitle.ambiguous, 0);
  const tie = matchSession({ workingDirectory: "/home/dev/atur", title: "zsh" }, sessions);
  assert.equal(tie.session.id, "b");
  assert.equal(tie.ambiguous, 1);
});

test("a parent folder alone is not enough to link a terminal", () => {
  const sessions = [normalizeSession(sessionRow({ cwd: "/home/dev/atur", title: "agent" }))];
  assert.equal(matchSession({ workingDirectory: "/home/dev/atur/apps/app", title: "zsh" }, sessions).session, null);
});

test("terminal text loses colour codes, trailing blanks and blank edges, and long output keeps its tail", () => {
  assert.equal(cleanScreen("\u001b[32mok\u001b[0m  \r\n\n  done\n\n\n"), "ok\n\n  done");
  assert.equal(cleanScreen("\u001b]0;title\u0007prompt $"), "prompt $");
  const long = cleanScreen(`${"x".repeat(20_000)}END`);
  assert.ok(long.startsWith("…\n"));
  assert.ok(long.endsWith("END"));
  assert.ok(long.length < 12_100);
});

test("evidence is HTML-escaped and omits empty parts", () => {
  const html = evidenceHtml({ summary: "fixed <b>it</b>", output: "$ test\n<script>alert(1)</script> ok", source: 'terminal "x"' });
  assert.match(html, /^<p><strong>Ready for review\.<\/strong> fixed &lt;b&gt;it&lt;\/b&gt;<\/p>/);
  assert.match(html, /<pre><code>\$ test\n&lt;script&gt;alert\(1\)&lt;\/script&gt; ok<\/code><\/pre>/);
  assert.ok(!html.includes("<script>"));
  assert.equal(evidenceHtml({ summary: "", output: "" }), "<p><strong>Ready for review.</strong></p>");
});

test("the claim comment uses the 'Picked up by <agent> (pane <id>)' convention", () => {
  assert.equal(claimComment({ agent: "omp", paneId: "77" }), "<p>Picked up by omp (pane 77).</p>");
  assert.equal(claimComment({ agent: "", paneId: null }), "<p>Picked up by Atur Terminal (Atur Terminal).</p>");
  assert.equal(claimComment({ agent: "<img>", paneId: "1" }), "<p>Picked up by &lt;img&gt; (pane 1).</p>");
});

test("small formatting helpers", () => {
  assert.deepEqual(findState([{ key: "todo" }, { key: "need_review", id: "x" }], "need_review"), { key: "need_review", id: "x" });
  assert.equal(findState([], "done"), null);
  const now = Date.parse("2026-10-30T12:00:00Z");
  assert.equal(timeAgo("2026-10-30T11:59:50Z", now), "just now");
  assert.equal(timeAgo("2026-10-30T11:15:00Z", now), "45m ago");
  assert.equal(timeAgo("2026-10-28T12:00:00Z", now), "2d ago");
  assert.equal(timeAgo("garbage", now), "");
  assert.equal(dueLabel("2026-10-29", "2026-10-30"), "Overdue · 10-29");
  assert.equal(dueLabel("2026-10-30", "2026-10-30"), "Due today");
  assert.equal(dueLabel(null), "");
  assert.equal(initials("Joyo Digitama"), "JD");
  assert.equal(initials(""), "?");
});
