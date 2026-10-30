import { escapeHtml } from "@atur/ui";
import { createApi } from "./lib/api.js";
import { SignedOutError, createAuth } from "./lib/auth.js";
import { createMcp } from "./lib/mcp.js";
import { STATE_LABELS, agentStateLabel, dueLabel, initials, matchSession, timeAgo } from "./lib/model.js";
import { sanitizeHtml } from "./lib/sanitize.js";
import * as host from "./host.js";
import { icon } from "./icons.js";

const REFRESH_MS = 60_000;
const VIEWS = [
  { id: "mine", label: "Mine" },
  { id: "inbox", label: "Inbox" },
  { id: "today", label: "Today" },
  { id: "agents", label: "Agents" },
];
const SIGN_IN_POLL_MS = 800;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function start(root) {
  const panel = host.isPanel();
  const auth = createAuth({ storage: host.storage, fetchFn: host.fetchFn });
  const api = createApi({ mcp: createMcp({ fetchFn: host.fetchFn, auth }) });

  const state = {
    phase: "loading", // loading | signin | ready
    signin: { mode: "oauth", status: "idle", message: "", flow: null, tabId: null, apiKey: "", pasted: "" },
    me: null,
    workspace: "all",
    workspaces: [],
    logos: {},
    view: host.data().view || "mine",
    lists: { mine: null, inbox: null, today: null, agents: null },
    errors: {},
    linked: null,
    selected: null, // { issue, detail, states, composer, comment, review, busy }
    menu: null, // "workspace" | "account"
    toast: "",
  };

  // ------------------------------------------------------------------ data

  function fail(section, error) {
    if (error instanceof SignedOutError) {
      state.phase = "signin";
      state.signin.message = error.message;
      return;
    }
    state.errors[section] = error?.message || String(error);
  }

  async function load(section, loader) {
    try {
      state.lists[section] = await loader();
      delete state.errors[section];
    } catch (error) {
      fail(section, error);
    }
  }

  const workspaceArg = () => (state.workspace === "all" ? undefined : state.workspace);

  async function refreshLinked() {
    try {
      const pane = await host.activePane();
      if (!pane) {
        state.linked = null;
        return;
      }
      let session = null;
      let ambiguous = 0;
      if (pane.sessionID != null) {
        session = await api.sessionForPane(pane.sessionID);
      } else {
        const all = await api.agentSessions({});
        ({ session, ambiguous } = matchSession(pane, all.sessions));
      }
      state.linked = { pane, session, ambiguous };
    } catch (error) {
      if (error instanceof SignedOutError) fail("linked", error);
      else state.linked = null;
    }
  }

  async function refreshAll() {
    if (state.phase === "signin") return;
    const ws = workspaceArg();
    await Promise.all([
      load("mine", () => api.myIssues({ workspace: ws, stateKeys: ["backlog", "todo", "in_progress", "needs_you", "need_review"] })),
      load("inbox", () => api.notifications()),
      load("today", () => api.today({ workspace: ws })),
      load("agents", () => api.agentSessions({ workspace: ws })),
      refreshLinked(),
    ]);
    render();
  }

  async function boot() {
    try {
      const current = await auth.load();
      if (!current) {
        state.phase = "signin";
        render();
        return;
      }
      state.phase = "ready";
      render();
      const [me, workspaces] = await Promise.all([api.whoami().catch(() => null), api.workspaces().catch((e) => (fail("workspaces", e), []))]);
      state.me = me;
      state.workspaces = workspaces;
      const saved = await host.storage.get("prefs");
      if (saved?.workspace && (saved.workspace === "all" || workspaces.some((w) => w.slug === saved.workspace))) state.workspace = saved.workspace;
      render();
      loadLogos();
      await refreshAll();
    } catch (error) {
      fail("boot", error);
      render();
    }
  }

  async function loadLogos() {
    for (const workspace of state.workspaces) {
      if (state.logos[workspace.slug] !== undefined) continue;
      state.logos[workspace.slug] = await api.workspaceLogo(workspace.slug);
      render();
    }
  }

  // ------------------------------------------------------------------ issue actions

  function findIssue(id) {
    const { mine, today, agents } = state.lists;
    const pool = [
      ...(mine?.items || []),
      ...(today ? Object.values(today).filter(Array.isArray).flat() : []),
      ...(agents?.sessions.map((s) => s.issue) || []),
    ];
    return pool.find((issue) => issue?.id === id) || null;
  }

  async function openIssue(issue, composer = null) {
    state.selected = { issue, detail: null, states: [], composer, comment: "", review: { summary: "", output: "" }, busy: false, error: "" };
    render();
    if (composer === "review") fillFromTerminal();
    try {
      const [detail, states] = await Promise.all([api.detail(issue), api.states(issue)]);
      if (state.selected?.issue.id !== issue.id) return;
      state.selected.detail = detail;
      state.selected.states = states;
      const current = states.find((s) => s.name === issue.stateName);
      if (current && !issue.stateKey) issue.stateKey = current.key;
    } catch (error) {
      if (state.selected?.issue.id === issue.id) state.selected.error = error.message;
      fail("detail", error);
    }
    render();
  }

  async function mutate(label, work) {
    const selected = state.selected;
    if (!selected || selected.busy) return;
    selected.busy = true;
    selected.error = "";
    render();
    try {
      await work(selected);
      host.toast("Atur", label);
      const issue = selected.issue;
      const [detail] = await Promise.all([api.detail(issue), refreshAll()]);
      if (state.selected === selected) selected.detail = detail;
    } catch (error) {
      selected.error = error?.message || String(error);
      fail("detail", error);
    } finally {
      selected.busy = false;
      render();
    }
  }

  async function fillFromTerminal() {
    const selected = state.selected;
    if (!selected) return;
    try {
      const pane = state.linked?.pane || (await host.activePane());
      if (!pane) throw new Error("No terminal is focused.");
      selected.review.output = await host.readScreen(pane.id);
      selected.review.source = `terminal "${pane.title || "pane"}"`;
    } catch (error) {
      selected.error = `Could not read the terminal: ${error.message}`;
    }
    render();
  }

  const actions = {
    async refresh() {
      await refreshAll();
    },
    "set-view": (el) => {
      state.view = el.dataset.view;
      state.selected = null;
      state.menu = null;
      host.setTitle(`Atur · ${VIEWS.find((v) => v.id === state.view).label}`);
      render();
    },
    "toggle-menu": (el) => {
      state.menu = state.menu === el.dataset.menu ? null : el.dataset.menu;
      render();
    },
    "set-workspace": async (el) => {
      state.workspace = el.dataset.slug;
      state.menu = null;
      host.storage.set("prefs", { workspace: state.workspace });
      render();
      await refreshAll();
    },
    "open-issue": (el) => {
      const issue = findIssue(el.dataset.id);
      if (issue) openIssue(issue);
    },
    "open-linked": (el) => {
      const issue = state.linked?.session?.issue;
      if (issue) openIssue(issue, el.dataset.composer || null);
    },
    "open-notification": async (el) => {
      const item = state.lists.inbox?.items.find((n) => n.id === el.dataset.id);
      if (!item) return;
      if (!item.read) {
        item.read = true;
        api.markNotificationRead(item.id).catch(() => {});
      }
      if (item.issueId && item.projectId && item.workspaceSlug) {
        openIssue({ id: item.issueId, key: "", name: item.title, projectId: item.projectId, workspaceSlug: item.workspaceSlug, workspaceName: item.workspaceName, stateName: "", stateKey: null, priority: "none", url: "https://app.diatur.com" });
      } else render();
    },
    back: () => {
      state.selected = null;
      render();
    },
    "open-web": (el) => {
      host.openBrowser(el.dataset.url).catch((error) => host.toast("Atur", error.message));
    },
    "open-in-tab": async () => {
      await host.openWorkspaceTab({ view: state.view });
    },
    "open-composer": (el) => {
      if (!state.selected) return;
      state.selected.composer = state.selected.composer === el.dataset.composer ? null : el.dataset.composer;
      render();
      if (state.selected?.composer === "review" && !state.selected.review.output) fillFromTerminal();
    },
    "fill-terminal": () => fillFromTerminal(),
    "post-comment": () =>
      mutate("Comment posted", async (s) => {
        const html = `<p>${escapeHtml(s.comment.trim()).replace(/\n/g, "<br>")}</p>`;
        if (!s.comment.trim()) throw new Error("Write a comment first.");
        await api.comment(s.issue, html);
        s.comment = "";
        s.composer = null;
      }),
    claim: () =>
      mutate("Claimed", async (s) => {
        const linked = state.linked?.session?.issue?.id === s.issue.id ? state.linked : null;
        const result = await api.claim(s.issue, { agent: linked?.session?.agent, paneId: linked?.pane?.sessionID });
        s.issue.stateName = result.name;
        s.issue.stateKey = result.key;
      }),
    "submit-review": () =>
      mutate("Marked Need Review", async (s) => {
        if (!s.review.summary.trim() && !s.review.output.trim()) throw new Error("Add a summary or terminal output as evidence.");
        const result = await api.needReview(s.issue, s.review);
        s.issue.stateName = result.name;
        s.issue.stateKey = result.key;
        s.review = { summary: "", output: "" };
        s.composer = null;
      }),
    "sign-in": () => signInOAuth(),
    "cancel-sign-in": () => cancelSignIn(),
    "finish-pasted": () => finishPasted(),
    "use-key": () => {
      state.signin.mode = state.signin.mode === "key" ? "oauth" : "key";
      render();
    },
    "submit-key": async () => {
      try {
        await auth.signInWithApiKey(state.signin.apiKey);
        state.signin.apiKey = "";
        await afterSignIn();
      } catch (error) {
        state.signin.message = error.message;
        render();
      }
    },
    "sign-out": async () => {
      state.menu = null;
      await auth.signOut();
      Object.assign(state, { me: null, workspaces: [], lists: { mine: null, inbox: null, today: null, agents: null }, linked: null, selected: null, phase: "signin" });
      state.signin.message = "Signed out.";
      render();
    },
  };

  // ------------------------------------------------------------------ sign in

  async function afterSignIn() {
    state.signin = { mode: "oauth", status: "idle", message: "", flow: null, tabId: null, apiKey: "", pasted: "" };
    state.phase = "loading";
    render();
    await boot();
  }

  async function signInOAuth() {
    const signin = state.signin;
    signin.message = "";
    signin.status = "starting";
    render();
    try {
      const flow = await auth.beginSignIn();
      const tabId = await host.openBrowser(flow.url);
      Object.assign(signin, { status: "waiting", flow, tabId });
      render();
      while (signin.status === "waiting" && !flow.expired()) {
        await sleep(SIGN_IN_POLL_MS);
        const tabs = await host.listBrowserTabs();
        const tab = tabs.find((t) => String(t.tabId) === String(tabId));
        if (!tab) throw new Error("The sign-in tab was closed before you finished.");
        if (flow.isCallback(tab.url)) {
          await flow.complete(tab.url);
          await host.closeBrowserTab(tabId).catch(() => {});
          await afterSignIn();
          return;
        }
      }
      if (signin.status === "waiting") throw new Error("Sign-in timed out. Try again.");
    } catch (error) {
      if (signin.status !== "idle") {
        signin.message = error.message;
        signin.status = "idle";
        render();
      }
    }
  }

  async function cancelSignIn() {
    const { tabId } = state.signin;
    state.signin.status = "idle";
    state.signin.message = "";
    if (tabId) await host.closeBrowserTab(tabId).catch(() => {});
    render();
  }

  async function finishPasted() {
    const { flow, pasted, tabId } = state.signin;
    try {
      await flow.complete(pasted);
      state.signin.status = "idle";
      if (tabId) await host.closeBrowserTab(tabId).catch(() => {});
      await afterSignIn();
    } catch (error) {
      state.signin.message = error.message;
      render();
    }
  }

  // ------------------------------------------------------------------ views

  function workspaceBadge(slug, name, size = 18) {
    const logo = state.logos[slug];
    return logo
      ? `<img class="wsicon" width="${size}" height="${size}" src="${escapeHtml(logo)}" alt="">`
      : `<span class="wsicon wsicon--text" style="width:${size}px;height:${size}px">${escapeHtml(initials(name))}</span>`;
  }

  function headerHtml() {
    const current = state.workspaces.find((w) => w.slug === state.workspace);
    const label = current ? current.name : "All workspaces";
    const menu =
      state.menu === "workspace"
        ? `<div class="mx-menu menu menu--left">
            <button class="mx-menu-item" data-action="set-workspace" data-slug="all">${workspaceBadge("all", "All")}<span>All workspaces</span>${state.workspace === "all" ? icon("check") : ""}</button>
            <div class="mx-menu-separator"></div>
            ${state.workspaces.map((w) => `<button class="mx-menu-item" data-action="set-workspace" data-slug="${escapeHtml(w.slug)}">${workspaceBadge(w.slug, w.name)}<span>${escapeHtml(w.name)}</span>${w.slug === state.workspace ? icon("check") : ""}</button>`).join("")}
          </div>`
        : "";
    const account =
      state.menu === "account"
        ? `<div class="mx-menu menu menu--right">
            <div class="menu__who">${escapeHtml(state.me?.displayName || state.me?.email || "Signed in")}</div>
            <button class="mx-menu-item" data-action="open-web" data-url="https://app.diatur.com">${icon("external")}<span>Open Atur</span></button>
            <button class="mx-menu-item is-danger" data-action="sign-out">${icon("out")}<span>Sign out</span></button>
          </div>`
        : "";
    return `<header class="mx-topbar bar">
      <div class="menuwrap">
        <button class="ws" data-action="toggle-menu" data-menu="workspace" aria-haspopup="menu">
          ${current ? workspaceBadge(current.slug, current.name) : workspaceBadge("all", "A")}
          <span class="ws__name">${escapeHtml(label)}</span>${icon("caret", 12)}
        </button>${menu}
      </div>
      <span class="mx-spacer"></span>
      <button class="mx-icon-btn" data-action="refresh" title="Refresh" aria-label="Refresh">${icon("refresh")}</button>
      <div class="menuwrap">
        <button class="mx-icon-btn" data-action="toggle-menu" data-menu="account" title="Account" aria-label="Account" aria-haspopup="menu">${icon("user")}</button>${account}
      </div>
    </header>`;
  }

  function linkedHtml() {
    const linked = state.linked;
    if (!linked) return "";
    const session = linked.session;
    if (!session) {
      return `<section class="linked linked--empty"><span class="mx-section-label">Active terminal</span><p class="muted">No Atur issue is linked to this terminal${linked.pane?.title ? ` (${escapeHtml(linked.pane.title)})` : ""}. Agents link themselves when they claim an issue.</p></section>`;
    }
    const issue = session.issue;
    return `<section class="linked">
      <div class="linked__head"><span class="mx-section-label">Active terminal</span>
        <span class="mx-badge ${session.state === "blocked" ? "mx-badge-accent" : ""}">${escapeHtml(agentStateLabel(session.state))}${session.agent ? ` · ${escapeHtml(session.agent)}` : ""}</span></div>
      <button class="linked__issue" data-action="open-linked"><span class="key">${escapeHtml(issue.key)}</span><span class="linked__name">${escapeHtml(issue.name)}</span></button>
      <div class="linked__meta muted">${escapeHtml(issue.stateName || "")}${linked.ambiguous ? ` · ${linked.ambiguous + 1} agents share this folder` : ""}</div>
      <div class="linked__actions">
        <button class="mx-btn" data-action="open-linked">Open</button>
        <button class="mx-btn" data-action="open-linked" data-composer="review">Need Review…</button>
        <button class="mx-btn mx-btn-ghost" data-action="open-linked" data-composer="comment">Comment</button>
      </div>
    </section>`;
  }

  function tabsHtml() {
    const count = (id) => {
      const { mine, inbox, agents } = state.lists;
      if (id === "mine") return mine?.total || 0;
      if (id === "inbox") return inbox?.unread || 0;
      if (id === "agents") return agents ? agents.needsYou.length : 0;
      return 0;
    };
    return `<nav class="mx-segmented views" role="tablist">${VIEWS.map((v) => {
      const n = count(v.id);
      return `<button class="mx-segmented-btn ${state.view === v.id ? "is-active" : ""}" role="tab" data-action="set-view" data-view="${v.id}">${v.label}${n ? ` <span class="n">${n}</span>` : ""}</button>`;
    }).join("")}</nav>`;
  }

  function issueRow(issue, { showAgent } = {}) {
    const stateText = issue.stateName || STATE_LABELS[issue.stateKey] || "";
    const bits = [issue.workspaceName && state.workspace === "all" ? issue.workspaceName : "", stateText, dueLabel(issue.targetDate)].filter(Boolean);
    const attention = issue.stateKey === "needs_you" || showAgent === "blocked";
    return `<button class="mx-row row" data-action="open-issue" data-id="${escapeHtml(issue.id)}">
      <span class="dot ${attention ? "dot--attn" : ""}" aria-hidden="true"></span>
      <span class="row__main"><span class="row__title"><span class="key">${escapeHtml(issue.key)}</span> ${escapeHtml(issue.name)}</span>
      <span class="row__sub">${escapeHtml(bits.join(" · "))}</span></span>
    </button>`;
  }

  const empty = (title, copy) => `<div class="mx-empty"><div class="mx-empty-title">${escapeHtml(title)}</div><div class="mx-empty-copy">${escapeHtml(copy)}</div></div>`;
  const errorBox = (message) => `<div class="error" role="alert">${escapeHtml(message)}</div>`;
  const loading = () => `<div class="mx-empty"><span class="mx-spinner mx-spinner-lg"></span></div>`;

  function section(label, issues, opts) {
    return issues.length ? `<div class="mx-section-label sec">${escapeHtml(label)} <span class="n">${issues.length}</span></div>${issues.map((i) => issueRow(i, opts)).join("")}` : "";
  }

  function listHtml() {
    const error = state.errors[state.view] ? errorBox(state.errors[state.view]) : "";
    const data = state.lists[state.view];
    if (!data) return error || loading();
    if (state.view === "mine") {
      return error + (data.items.length ? `<div class="mx-list">${data.items.map((i) => issueRow(i)).join("")}</div>` : empty("Nothing assigned to you", "Issues assigned to you across your workspaces appear here."));
    }
    if (state.view === "today") {
      const body = [
        section("Overdue", data.overdue),
        section("Due today", data.dueToday),
        section("Needs you", data.needsYou),
        section("Need review", data.needReview),
        section("In progress", data.inProgress),
        section("Due this week", data.dueThisWeek),
      ].join("");
      return error + (body ? `<div class="mx-list">${body}</div>` : empty("A clear day", "Nothing is due or waiting on you."));
    }
    if (state.view === "agents") {
      const body = [section("Needs you", data.needsYou.map((s) => ({ ...s.issue, agent: s.agent })), { showAgent: "blocked" }), section("Done", data.done.map((s) => ({ ...s.issue, agent: s.agent })))].join("");
      return error + (body ? `<div class="mx-list">${body}</div>` : empty("No agents waiting", "Agents that finish or need a decision show up here."));
    }
    // inbox
    return (
      error +
      (data.items.length
        ? `<div class="mx-list">${data.items
            .map(
              (n) => `<button class="mx-row row" data-action="open-notification" data-id="${escapeHtml(n.id)}">
        <span class="dot ${n.read ? "dot--read" : "dot--attn"}" aria-hidden="true"></span>
        <span class="row__main"><span class="row__title">${escapeHtml(n.title)}</span>
        <span class="row__sub">${escapeHtml([n.workspaceName, timeAgo(n.createdAt)].filter(Boolean).join(" · "))}</span></span></button>`,
            )
            .join("")}</div>`
        : empty("Inbox zero", "Mentions, comments and assignments land here."))
    );
  }

  function detailHtml() {
    const s = state.selected;
    const issue = s.issue;
    const stateOptions = s.states.length
      ? `<select class="mx-select" data-field="state" ${s.busy ? "disabled" : ""} aria-label="State">${s.states
          .map((st) => `<option value="${escapeHtml(st.id)}" ${st.name === issue.stateName ? "selected" : ""}>${escapeHtml(st.name)}</option>`)
          .join("")}</select>`
      : `<span class="mx-badge">${escapeHtml(issue.stateName || "…")}</span>`;
    const comments = s.detail
      ? s.detail.comments
          .map(
            (c) => `<div class="comment"><div class="comment__meta muted">${c.actorId && c.actorId === state.me?.id ? "You" : "Comment"} · ${escapeHtml(timeAgo(c.createdAt))}</div><div class="rich">${sanitizeHtml(c.html)}</div></div>`,
          )
          .join("")
      : loading();
    const composer =
      s.composer === "comment"
        ? `<div class="composer"><textarea class="mx-textarea" data-field="comment" rows="3" placeholder="Write a comment">${escapeHtml(s.comment)}</textarea>
            <div class="composer__row"><span class="mx-spacer"></span><button class="mx-btn mx-btn-primary" data-action="post-comment" ${s.busy ? "disabled" : ""}>${icon("send")} Comment</button></div></div>`
        : s.composer === "review"
          ? `<div class="composer"><div class="mx-section-label">Mark Need Review</div>
              <input class="mx-input" data-field="summary" placeholder="What changed, in a line" value="${escapeHtml(s.review.summary)}">
              <textarea class="mx-textarea mono" data-field="output" rows="8" placeholder="Evidence: test or command output">${escapeHtml(s.review.output)}</textarea>
              <div class="composer__row"><button class="mx-btn" data-action="fill-terminal">${icon("terminal")} Paste terminal output</button><span class="mx-spacer"></span>
              <button class="mx-btn mx-btn-primary" data-action="submit-review" ${s.busy ? "disabled" : ""}>Mark Need Review</button></div></div>`
          : "";
    return `<article class="detail">
      <div class="detail__bar">${panel ? `<button class="mx-icon-btn" data-action="back" aria-label="Back" title="Back">${icon("back")}</button>` : ""}
        <span class="key">${escapeHtml(issue.key)}</span>${stateOptions}<span class="mx-spacer"></span>
        <button class="mx-icon-btn" data-action="open-web" data-url="${escapeHtml(issue.url)}" title="Open in Atur" aria-label="Open in Atur">${icon("external")}</button></div>
      <h2 class="detail__title">${escapeHtml(issue.name)}</h2>
      <div class="detail__meta muted">${escapeHtml([issue.workspaceName, issue.projectName, dueLabel(issue.targetDate)].filter(Boolean).join(" · "))}</div>
      <div class="detail__actions">
        <button class="mx-btn" data-action="claim" ${s.busy ? "disabled" : ""}>Claim</button>
        <button class="mx-btn" data-action="open-composer" data-composer="review">Need Review…</button>
        <button class="mx-btn mx-btn-ghost" data-action="open-composer" data-composer="comment">Comment</button>
      </div>
      ${s.error ? errorBox(s.error) : ""}${composer}
      ${s.detail?.descriptionHtml ? `<div class="rich desc">${sanitizeHtml(s.detail.descriptionHtml)}</div>` : ""}
      <div class="mx-section-label sec">Comments</div>${comments || '<div class="muted">No comments yet.</div>'}
    </article>`;
  }

  function signInHtml() {
    const s = state.signin;
    const waiting = s.status === "waiting";
    const key = s.mode === "key";
    return `<main class="signin">
      <div class="signin__logo">${icon("user", 22)}</div>
      <h1>Sign in to Atur</h1>
      <p class="muted">See your issues, inbox and the agents waiting on you without leaving the terminal.</p>
      ${s.message ? errorBox(s.message) : ""}
      ${
        waiting
          ? `<p>Finish signing in in the browser tab that just opened. This view continues on its own.</p>
             <input class="mx-input" data-field="pasted" placeholder="…or paste the final address here" value="${escapeHtml(s.pasted)}">
             <div class="signin__row"><button class="mx-btn mx-btn-primary" data-action="finish-pasted" ${s.pasted ? "" : "disabled"}>Finish</button><button class="mx-btn mx-btn-ghost" data-action="cancel-sign-in">Cancel</button></div>`
          : key
            ? `<input class="mx-input" type="password" autocomplete="off" spellcheck="false" data-field="apiKey" placeholder="pk_live_…" value="${escapeHtml(s.apiKey)}">
               <div class="signin__row"><button class="mx-btn mx-btn-primary" data-action="submit-key" ${s.apiKey ? "" : "disabled"}>Use API key</button><button class="mx-btn mx-btn-ghost" data-action="use-key">Back</button></div>`
            : `<button class="mx-btn mx-btn-primary signin__main" data-action="sign-in" ${s.status === "starting" ? "disabled" : ""}>Sign in with Atur</button>
               <button class="mx-btn mx-btn-ghost" data-action="use-key">Use an API key instead</button>`
      }
    </main>`;
  }

  function readyHtml() {
    const s = state.selected;
    if (panel) return `${headerHtml()}${s ? `<div class="scroll">${detailHtml()}</div>` : `${linkedHtml()}${tabsHtml()}<div class="scroll">${listHtml()}</div>`}`;
    return `${headerHtml()}${linkedHtml()}${tabsHtml()}<div class="split"><div class="scroll split__list">${listHtml()}</div><div class="scroll split__detail">${s ? detailHtml() : empty("Select an issue", "Open one to change its state, comment, claim it or send it to review.")}</div></div>`;
  }

  // ------------------------------------------------------------------ render

  function render() {
    const active = document.activeElement;
    const field = active?.dataset?.field;
    const selection = field && "selectionStart" in active ? [active.selectionStart, active.selectionEnd] : null;
    const scrollers = [...root.querySelectorAll(".scroll")].map((el) => el.scrollTop);
    root.className = panel ? "app app--panel" : "app app--tab";
    root.innerHTML = state.phase === "signin" ? signInHtml() : state.phase === "loading" ? loading() : readyHtml();
    root.querySelectorAll(".scroll").forEach((el, i) => {
      el.scrollTop = scrollers[i] || 0;
    });
    if (field) {
      const next = root.querySelector(`[data-field="${field}"]`);
      if (next) {
        next.focus();
        if (selection) next.setSelectionRange(selection[0], selection[1]);
      }
    }
  }

  root.addEventListener("click", (event) => {
    const link = event.target.closest("a[data-href]");
    if (link) {
      event.preventDefault();
      host.openBrowser(link.dataset.href).catch(() => {});
      return;
    }
    const el = event.target.closest("[data-action]");
    if (!el) {
      if (state.menu) {
        state.menu = null;
        render();
      }
      return;
    }
    actions[el.dataset.action]?.(el);
  });

  root.addEventListener("input", (event) => {
    const el = event.target;
    const field = el.dataset?.field;
    if (!field) return;
    const s = state.selected;
    if (field === "comment" && s) s.comment = el.value;
    else if (field === "summary" && s) s.review.summary = el.value;
    else if (field === "output" && s) s.review.output = el.value;
    else if (field === "apiKey") {
      state.signin.apiKey = el.value;
      root.querySelector('[data-action="submit-key"]')?.toggleAttribute("disabled", !el.value);
    } else if (field === "pasted") {
      state.signin.pasted = el.value;
      root.querySelector('[data-action="finish-pasted"]')?.toggleAttribute("disabled", !el.value);
    }
  });

  root.addEventListener("change", (event) => {
    if (event.target.dataset?.field !== "state" || !state.selected) return;
    const stateId = event.target.value;
    const chosen = state.selected.states.find((st) => st.id === stateId);
    mutate(`Moved to ${chosen?.name || "new state"}`, async (s) => {
      await api.setState(s.issue, stateId);
      s.issue.stateName = chosen?.name || "";
      s.issue.stateKey = chosen?.key || null;
    });
  });

  // ------------------------------------------------------------------ lifecycle

  let linkedTimer = null;
  let refreshTimer = null;
  const scheduleLinked = () => {
    clearTimeout(linkedTimer);
    linkedTimer = setTimeout(async () => {
      if (state.phase !== "ready") return;
      await refreshLinked();
      render();
    }, 400);
  };
  host.subscribe(["pane.focused", "tab.focused", "project.switched"], scheduleLinked);
  host.subscribe(["agent.status"], () => {
    scheduleLinked();
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refreshAll, 1500);
  });
  host.onFocus(async (focused) => {
    if (!focused) return;
    const current = await auth.load();
    if (current && state.phase === "signin" && state.signin.status === "idle") await boot();
    else if (!current && state.phase === "ready") {
      state.phase = "signin";
      render();
    } else if (state.phase === "ready") refreshAll();
  });
  setInterval(() => {
    if (state.phase === "ready" && !state.selected?.busy) refreshAll();
  }, REFRESH_MS);
  host.onDataChange((data) => {
    if (data?.view && VIEWS.some((v) => v.id === data.view)) actions["set-view"]({ dataset: { view: data.view } });
  });

  render();
  boot();
}
