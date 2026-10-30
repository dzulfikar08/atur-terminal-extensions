// Sample GSD projects for the gsd-control-tower extension: a virtual .planning/ tree served
// through atur.files, plus project, worktree, git and agent inventory.
(() => {
  const h = window.__harness;
  const day = (n) => new Date(Date.now() - n * 86400000).toISOString();
  const date = (n) => day(n).slice(0, 10);

  const webState = `---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: Public Launch
status: active
last_updated: "${day(0.1)}"
last_activity: ${date(0)}
progress:
  total_phases: 4
  completed_phases: 2
  total_plans: 7
  completed_plans: 5
  percent: 71
---

# Project State

## Current Position

Phase: 3 of 4 — Checkout Flow
Plan: 2 of 3
Status: Executing — plan 03-02 in progress
Last activity: ${date(0)} — Completed plan 03-01 (cart summary)

## Session Continuity

Last session: ${date(0)}
`;
  const webRoadmap = `# Roadmap: acme-web

## Phases

- [x] **Phase 1: Project Setup** - Tooling, CI, and design tokens.
- [x] **Phase 2: Authentication** - Sign-in, sessions, and account pages.
- [ ] **Phase 3: Checkout Flow** - Cart, payment, and order confirmation.
- [ ] **Phase 4: Launch Hardening** - Performance, accessibility, and release checks.

## Phase Details

### Phase 1: Project Setup
**Goal:** Tooling, CI, and design tokens are in place.

### Phase 2: Authentication
**Goal:** Users can sign in, stay signed in, and manage their account.

### Phase 3: Checkout Flow
**Goal:** A customer can review a cart, pay, and see an order confirmation.

### Phase 4: Launch Hardening
**Goal:** The site meets performance and accessibility targets before launch.
`;
  const verification = (phase, score) => `---
phase: ${phase}
verified: ${day(6)}
status: passed
score: ${score}
---

# Verification Report

**Status:** passed
`;
  const plan = (phase, n, title) => `---
phase: ${phase}
plan: ${n}
type: execute
wave: 1
autonomous: true
---

# Plan ${n}: ${title}
`;

  const apiState = `---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: Orders API
status: active
last_updated: "${day(1)}"
last_activity: ${date(1)}
progress:
  total_phases: 3
  completed_phases: 1
  total_plans: 4
  completed_plans: 2
  percent: 50
---

# Project State

## Current Position

Phase: 2 of 3 — Inventory Sync
Plan: Not started
Status: Ready — Phase 1 passed verification
Last activity: ${date(1)} — Phase 1 verified
`;
  const apiRoadmap = `# Roadmap: acme-api

## Phases

- [x] **Phase 1: Schema and Migrations** - Core tables and migration tooling.
- [ ] **Phase 2: Inventory Sync** - Reconcile stock levels with the warehouse feed.
- [ ] **Phase 3: Public Endpoints** - Versioned REST endpoints with rate limits.

## Phase Details

### Phase 1: Schema and Migrations
**Goal:** Core tables and migration tooling.

### Phase 2: Inventory Sync
**Goal:** Stock levels stay consistent with the warehouse feed.

### Phase 3: Public Endpoints
**Goal:** Versioned REST endpoints with rate limits.
`;

  const mobileState = `---
gsd_state_version: 1.0
milestone: v0.4
milestone_name: Offline Mode
status: active
last_updated: "${day(2)}"
last_activity: ${date(2)}
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 3
  completed_plans: 0
  percent: 0
---

# Project State

## Current Position

Phase: 1 of 3 — Local Cache
Plan: Not started
Status: Ready — roadmap approved
Last activity: ${date(2)} — Roadmap created
`;
  const mobileRoadmap = `# Roadmap: acme-mobile

## Phases

- [ ] **Phase 1: Local Cache** - Persist recent orders on the device.
- [ ] **Phase 2: Sync Queue** - Queue edits made offline.
- [ ] **Phase 3: Conflict UI** - Resolve edits that collided.

## Phase Details

### Phase 1: Local Cache
**Goal:** Recent orders are readable without a connection.

### Phase 2: Sync Queue
**Goal:** Offline edits are queued and replayed.

### Phase 3: Conflict UI
**Goal:** Users can resolve conflicting edits.
`;
  const infraState = `---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: Staging Environment
status: complete
last_updated: "${day(5)}"
last_activity: ${date(5)}
progress:
  total_phases: 1
  completed_phases: 1
  total_plans: 1
  completed_plans: 1
  percent: 100
---

# Project State

## Current Position

Phase: 1 of 1 complete (Networking)
Status: Complete — staging environment verified
Last activity: ${date(5)} — Phase 1 verified
`;
  const infraRoadmap = `# Roadmap: acme-infra

## Phases

- [x] **Phase 1: Networking** - VPC, subnets, and routing.

## Phase Details

### Phase 1: Networking
**Goal:** VPC, subnets, and routing for staging.
`;
  const oauthState = `---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: Public Launch
status: paused
last_updated: "${day(3)}"
last_activity: ${date(3)}
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 7
  completed_plans: 2
  percent: 29
---

# Project State

## Current Position

Phase: 2 of 4 — Authentication
Plan: 2 of 3
Status: Paused — waiting on identity provider credentials
Last activity: ${date(3)} — Callback route implemented
`;

  const trees = {
    "w-web-main": {
      ".planning/STATE.md": webState,
      ".planning/ROADMAP.md": webRoadmap,
      ".planning/PROJECT.md": "# acme-web\n\n## What This Is\n\nA storefront web app.\n",
      ".planning/config.json": JSON.stringify({ model_profile: "balanced", workflow: { research: true, verifier: true } }),
      ".planning/phases/01-project-setup/01-01-PLAN.md": plan("01-project-setup", "01", "CI and tooling"),
      ".planning/phases/01-project-setup/01-01-SUMMARY.md": "# Summary\n",
      ".planning/phases/01-project-setup/01-VERIFICATION.md": verification("01-project-setup", "4/4 requirements verified"),
      ".planning/phases/02-authentication/02-CONTEXT.md": "# Context\n",
      ".planning/phases/02-authentication/02-RESEARCH.md": "# Research\n",
      ".planning/phases/02-authentication/02-01-PLAN.md": plan("02-authentication", "01", "Sign-in routes"),
      ".planning/phases/02-authentication/02-01-SUMMARY.md": "# Summary\n",
      ".planning/phases/02-authentication/02-02-PLAN.md": plan("02-authentication", "02", "Session handling"),
      ".planning/phases/02-authentication/02-02-SUMMARY.md": "# Summary\n",
      ".planning/phases/02-authentication/02-VERIFICATION.md": verification("02-authentication", "6/6 requirements verified"),
      ".planning/phases/03-checkout-flow/03-CONTEXT.md": "# Context\n",
      ".planning/phases/03-checkout-flow/03-RESEARCH.md": "# Research\n",
      ".planning/phases/03-checkout-flow/03-UI-SPEC.md": "# UI spec\n",
      ".planning/phases/03-checkout-flow/03-01-PLAN.md": plan("03-checkout-flow", "01", "Cart summary"),
      ".planning/phases/03-checkout-flow/03-01-SUMMARY.md": "# Summary\n",
      ".planning/phases/03-checkout-flow/03-02-PLAN.md": plan("03-checkout-flow", "02", "Payment form"),
      ".planning/phases/03-checkout-flow/03-03-PLAN.md": plan("03-checkout-flow", "03", "Order confirmation"),
      "src/index.ts": "",
    },
    "w-web-oauth": {
      ".planning/STATE.md": oauthState,
      ".planning/ROADMAP.md": webRoadmap,
      ".planning/phases/02-authentication/.continue-here.md": "# Continue\n",
      ".planning/phases/02-authentication/02-01-PLAN.md": plan("02-authentication", "01", "Sign-in routes"),
    },
    "w-api-main": {
      ".planning/STATE.md": apiState,
      ".planning/ROADMAP.md": apiRoadmap,
      ".planning/phases/01-schema-and-migrations/01-01-PLAN.md": plan("01-schema-and-migrations", "01", "Core tables"),
      ".planning/phases/01-schema-and-migrations/01-01-SUMMARY.md": "# Summary\n",
      ".planning/phases/01-schema-and-migrations/01-VERIFICATION.md": verification("01-schema-and-migrations", "3/3 requirements verified"),
    },
    "w-docs-main": {},
    "w-mobile-main": {
      ".planning/STATE.md": mobileState,
      ".planning/ROADMAP.md": mobileRoadmap,
    },
    "w-infra-main": {
      ".planning/STATE.md": infraState,
      ".planning/ROADMAP.md": infraRoadmap,
      ".planning/phases/01-networking/01-01-PLAN.md": plan("01-networking", "01", "VPC layout"),
      ".planning/phases/01-networking/01-01-SUMMARY.md": "# Summary\n",
      ".planning/phases/01-networking/01-VERIFICATION.md": verification("01-networking", "5/5 requirements verified"),
    },
  };

  const projects = [
    { id: "p-web", name: "acme-web", path: "/home/dev/acme-web", isActive: true },
    { id: "p-api", name: "acme-api", path: "/home/dev/acme-api", isActive: false },
    { id: "p-docs", name: "acme-docs", path: "/home/dev/acme-docs", isActive: false },
    { id: "p-mobile", name: "acme-mobile", path: "/home/dev/acme-mobile", isActive: false },
    { id: "p-infra", name: "acme-infra", path: "/home/dev/acme-infra", isActive: false },
  ];
  const worktrees = {
    "p-web": [
      { id: "w-web-main", name: "main", path: "/home/dev/acme-web", branch: "main", isPrimary: true, isActive: true },
      { id: "w-web-oauth", name: "oauth-login", path: "/home/dev/acme-web-oauth", branch: "feature/oauth-login", isPrimary: false },
    ],
    "p-api": [{ id: "w-api-main", name: "main", path: "/home/dev/acme-api", branch: "main", isPrimary: true, isActive: true }],
    "p-docs": [{ id: "w-docs-main", name: "main", path: "/home/dev/acme-docs", branch: "main", isPrimary: true, isActive: true }],
    "p-mobile": [{ id: "w-mobile-main", name: "main", path: "/home/dev/acme-mobile", branch: "main", isPrimary: true, isActive: true }],
    "p-infra": [{ id: "w-infra-main", name: "main", path: "/home/dev/acme-infra", branch: "main", isPrimary: true, isActive: true }],
  };
  const gitInfo = {
    "w-web-main": { branch: "main", dirty: 3, subject: "Add cart summary component", at: day(0.2) },
    "w-web-oauth": { branch: "feature/oauth-login", dirty: 0, subject: "Implement OAuth callback route", at: day(3) },
    "w-api-main": { branch: "main", dirty: 1, subject: "Add inventory migration", at: day(1) },
    "w-docs-main": { branch: "main", dirty: 0, subject: "Update contributing guide", at: day(9) },
    "w-mobile-main": { branch: "main", dirty: 0, subject: "Create offline mode roadmap", at: day(2) },
    "w-infra-main": { branch: "main", dirty: 0, subject: "Verify staging networking", at: day(5) },
  };
  const roots = Object.fromEntries(Object.entries(worktrees).flatMap(([, list]) => list.map((w) => [w.id, w.path])));

  const selectorTree = (opts) => trees[opts && opts.project];
  const dirOf = (tree, path) => {
    const prefix = path === "." || path === "" ? "" : path.replace(/\/+$/, "") + "/";
    const seen = new Map();
    for (const file of Object.keys(tree)) {
      if (!file.startsWith(prefix)) continue;
      const rest = file.slice(prefix.length);
      const name = rest.split("/")[0];
      if (!seen.has(name)) seen.set(name, { name, path: prefix + name, isDirectory: rest.includes("/") });
    }
    return [...seen.values()];
  };

  Object.assign(h.base, {
    projects: { list: async () => projects },
    worktrees: { list: async (projectId) => worktrees[projectId] || [] },
    files: {
      read: async (path, opts) => {
        const tree = selectorTree(opts);
        if (tree && path in tree) return { content: tree[path] };
        throw new Error("no such file: " + path);
      },
      list: async (path, opts) => {
        const tree = selectorTree(opts);
        const entries = tree ? dirOf(tree, path) : [];
        if (!entries.length) throw new Error("no such file: " + path);
        return entries;
      },
    },
    git: {
      repoInfo: async (opts) => ({ root: roots[opts.project] }),
      status: async (opts) => {
        const g = gitInfo[opts.project];
        const files = Array.from({ length: g.dirty }, (_, i) => ({ path: "src/file-" + i + ".ts" }));
        return { branch: g.branch, stagedFiles: [], unstagedFiles: files };
      },
      log: async (opts) => [{ authorDate: gitInfo[opts.project].at, subject: gitInfo[opts.project].subject }],
    },
    agents: {
      list: async () => [
        { worktreeID: "w-web-main", projectID: "p-web", paneID: "pane-1", providerID: "claude", status: "working" },
        { worktreeID: "w-api-main", projectID: "p-api", paneID: "pane-2", providerID: "codex", status: "waiting" },
      ],
    },
  });

  const scene = (window.atur.data && window.atur.data.scene) || "project";
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const until = async (test) => { for (let i = 0; i < 100 && !test(); i += 1) await sleep(100); };
  window.addEventListener("load", async () => {
    await until(() => document.querySelector(".ct-row, .ct-detail-head"));
    await sleep(600);
    if (scene === "project") {
      await until(() => document.querySelector(".ct-phase-head"));
      const open = (needle) => [...document.querySelectorAll(".ct-phase-head")].find((b) => b.textContent.includes(needle))?.click();
      open("Checkout Flow");
      await sleep(150);
      open("Authentication");
    } else if (scene === "list") {
      document.querySelector(".ct-crumb")?.click();
      await until(() => document.querySelector(".ct-row"));
    }
    await sleep(500);
    window.__ready = true;
  });
})();
