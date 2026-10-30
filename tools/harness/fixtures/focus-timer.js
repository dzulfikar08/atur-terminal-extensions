// Sample data for focus-timer: stands in for the background engine. The popover and the
// report tab talk to it over extension.ft.* events, so this fixture answers those events.
(() => {
  const h = window.__harness;
  const pad = (n) => String(n).padStart(2, "0");
  const dayKey = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const DAY = 86400000;
  const now = Date.now();

  const ctx = {
    projects: {
      p1: { name: "acme-web", path: "/home/dev/acme-web", iconColor: "#4c8bf5" },
      p2: { name: "acme-api", path: "/home/dev/acme-api", iconColor: "#34c38f" },
      p3: { name: "docs-site", path: "/home/dev/docs-site", iconColor: "#f5a14c" },
      p4: { name: "infra", path: "/home/dev/infra", iconColor: "#b26bf0" },
    },
    worktrees: {
      w1: { name: "acme-web", branch: "main", projectID: "p1" },
      w2: { name: "acme-web-login", branch: "feature/login", projectID: "p1" },
      w3: { name: "acme-api", branch: "main", projectID: "p2" },
      w4: { name: "docs-site", branch: "main", projectID: "p3" },
      w5: { name: "infra", branch: "main", projectID: "p4" },
    },
  };

  // Deterministic pseudo-random so renders are stable.
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const min = (m) => Math.round(m) * 60;

  const days = {};
  for (let i = 40; i >= 1; i -= 1) {
    const ts = now - i * DAY;
    const dow = new Date(ts).getDay();
    const weekend = dow === 0 || dow === 6;
    const scale = weekend ? 0.15 : 1;
    const d = { projects: {}, worktrees: {} };
    const put = (pid, wid, you, agent, pomos) => {
      d.projects[pid] = { you: min(you * scale), agent: min(agent * scale), pomos: weekend ? 0 : pomos };
      d.worktrees[wid] = { you: min(you * scale * 0.8), agent: min(agent * scale) };
    };
    put("p1", "w1", 90 + rnd() * 80, 40 + rnd() * 40, 3 + Math.floor(rnd() * 3));
    put("p2", "w3", 40 + rnd() * 70, 20 + rnd() * 30, 1 + Math.floor(rnd() * 3));
    if (rnd() > 0.4) put("p3", "w4", 15 + rnd() * 40, 0, 1);
    if (rnd() > 0.7) put("p4", "w5", 10 + rnd() * 30, 5, 0);
    if (!weekend) d.worktrees.w2 = { you: min(25 + rnd() * 30), agent: min(10) };
    days[dayKey(ts)] = d;
  }
  const todayKey = dayKey(now);
  days[todayKey] = {
    projects: {
      p1: { you: min(131), agent: min(64), pomos: 3 },
      p2: { you: min(48), agent: min(22), pomos: 1 },
      p3: { you: min(19), agent: 0, pomos: 0 },
    },
    worktrees: { w1: { you: min(100), agent: min(40) }, w2: { you: min(31), agent: min(24) }, w3: { you: min(48), agent: min(22) }, w4: { you: min(19), agent: 0 } },
  };

  const pomoLog = [];
  for (let i = 0; i < 60; i += 1) {
    pomoLog.push({ startedAt: now - i * 2.5 * 3600000, minutes: 25, projectID: i % 3 === 0 ? "p2" : "p1", completed: i % 9 !== 4 });
  }

  const config = {
    version: 1, mode: "atur", idleSec: 120, assumeActiveMin: 10, workHours: null, paused: false,
    pomo: { focusMin: 25, breakMin: 5, longBreakMin: 15, cadence: 4, autoStartBreaks: true, autoStartFocus: false, notify: true },
  };

  const t = days[todayKey].projects;
  const byProject = ["p1", "p2", "p3"].map((id) => ({
    projectID: id, you: t[id].you, agent: t[id].agent, pomos: t[id].pomos,
    name: ctx.projects[id].name, iconColor: ctx.projects[id].iconColor, active: id === "p1",
  }));
  const state = {
    at: now, config,
    pomo: { phase: "focus", running: true, paused: false, pending: null, remainingMs: null, endsAt: now + (14 * 60 + 32) * 1000, cycle: 2, cadence: 4, dotsFilled: 2 },
    today: {
      day: todayKey, total: byProject.reduce((s, p) => s + p.you, 0), agentTotal: byProject.reduce((s, p) => s + p.agent, 0),
      pomos: 4, degraded: false, byProject,
    },
    tracking: { status: "active", degraded: false, probeDenied: false, activeProjectID: "p1", activeProjectName: "acme-web", segmentOpen: true },
    persist: { mode: "file", canWrite: true },
  };

  const slice = (from, to) => {
    const out = {};
    for (const k of Object.keys(days)) if (k >= from && k <= to) out[k] = days[k];
    return out;
  };

  h.set("projects.list", async () => Object.entries(ctx.projects).map(([id, p]) => ({ id, ...p, isActive: id === "p1" })));
  h.set("agents.list", async () => []);
  h.set("worktrees.list", async () => Object.entries(ctx.worktrees).map(([id, w]) => ({ id, ...w })));
  h.set("dialog.confirm", async () => "Cancel");

  const sub = window.atur.events.subscribe;
  sub("extension.ft.hello", () => setTimeout(() => h.emit("extension.ft.state", state), 30));
  sub("extension.ft.query", (p) => setTimeout(() => h.emit("extension.ft.report", {
    from: p.from, to: p.to, days: slice(p.from, p.to), ctx, pomoLog,
    tracking: { degraded: false, probeDenied: false }, persist: { mode: "file" },
  }), 30));

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const until = async (test) => { for (let i = 0; i < 100 && !test(); i += 1) await sleep(100); };
  window.addEventListener("load", async () => {
    await until(() => document.querySelector(".proj-row, .project-row"));
    await sleep(600);
    window.__ready = true;
  });
})();
