// Sample Hermes Dashboard for the hermes-agent extension. Serves the Dashboard's HTTP API through the
// curl relay (atur.execAsync), the live agent gateway through a fake WebSocket, and a saved sign-in.
(() => {
  const h = window.__harness;
  const now = Date.now();
  const iso = (ms) => new Date(now + ms).toISOString();
  const HOUR = 3600 * 1000;
  const BASE = "http://127.0.0.1:9119";
  const BOARD = "acme-web";

  const scene = (window.atur.data && window.atur.data.scene) || "ops";

  // ---- saved sign-in and project board mapping (extension storage) ---------------------------
  if (scene !== "signin") h.memory.set("session.dashboard.v2", {
    baseUrl: BASE,
    auth: {
      version: 1,
      providers: [{ name: "password", displayName: "Password", supportsPassword: true }],
      identity: { userId: "u-demo", email: "", displayName: "demo-operator", organizationId: "", provider: "password", expiresAt: Math.floor(now / 1000) + 30 * 86400 },
      cookies: [["hermes_session_at", "demoaccesstoken0123456789"], ["hermes_session_rt", "demorefreshtoken0123456789"], ["hermes_session_provider", "password"]],
    },
  });
  if (scene !== "signin") h.memory.set("board.mapping.v1.p-acme-web", { baseUrl: BASE, board: BOARD });
  h.set("projects.list", async () => [{ id: "p-acme-web", name: "acme-web", path: "/home/dev/acme-web", isActive: true }]);

  // ---- Dashboard HTTP API ----------------------------------------------------------------------
  const task = (id, title, status, extra = {}) => ({ id, title, status, assignee: null, tenant: BOARD, priority: 0, comment_count: 0, latest_summary: null, ...extra });
  const board = {
    board: BOARD,
    columns: [
      { name: "triage", tasks: [
        task("t_101", "Investigate slow dashboard load on mobile", "triage", { assignee: "researcher", priority: 2, comment_count: 1, latest_summary: "Waiting for a trace from the staging build." }),
      ] },
      { name: "todo", tasks: [
        task("t_102", "Draft the launch announcement", "todo", { assignee: "writer", priority: 1 }),
        task("t_103", "Add alt text to marketing images", "todo", { assignee: "builder", priority: 3 }),
      ] },
      { name: "scheduled", tasks: [
        task("t_104", "Weekly dependency audit", "scheduled", { assignee: "builder", priority: 2, latest_summary: "Runs every Monday at 09:00." }),
      ] },
      { name: "ready", tasks: [
        task("t_105", "Write tests for cart totals", "ready", { assignee: "builder", priority: 1, comment_count: 2, progress: { done: 1, total: 3 } }),
        task("t_106", "Update the contributing guide", "ready", { assignee: "writer", priority: 3 }),
      ] },
      { name: "running", tasks: [
        task("t_107", "Migrate checkout form to the new design system", "running", { assignee: "builder", priority: 1, comment_count: 3, latest_summary: "Converted 4 of 6 form fields.", progress: { done: 4, total: 6 } }),
        task("t_108", "Summarize open pull requests", "running", { assignee: "researcher", priority: 2 }),
      ] },
      { name: "blocked", tasks: [
        task("t_109", "Rotate the staging API token", "blocked", { assignee: "builder", priority: 1, comment_count: 1, latest_summary: "Needs an operator to approve the new token." }),
      ] },
      { name: "review", tasks: [
        task("t_110", "Fix flaky checkout test on slow runners", "review", { assignee: "builder", priority: 1, comment_count: 2, latest_summary: "Test now waits for the order confirmation." }),
        task("t_111", "Refresh the onboarding screenshots", "review", { assignee: "writer", priority: 3 }),
      ] },
      { name: "done", tasks: [
        task("t_112", "Set up preview deploys", "done", { assignee: "builder", priority: 1, latest_summary: "Every pull request now gets a preview URL." }),
        task("t_113", "Document environment variables", "done", { assignee: "writer", priority: 3 }),
        task("t_114", "Upgrade to Node 22", "done", { assignee: "builder", priority: 2 }),
      ] },
    ],
    assignees: ["builder", "researcher", "writer"],
    tenants: [BOARD],
  };
  const stats = { by_status: { triage: 1, todo: 2, scheduled: 1, ready: 2, running: 2, blocked: 1, review: 2, done: 3 }, oldest_ready_age_seconds: 1380 };
  const jobs = [
    { id: "j1", name: "Nightly dependency audit", enabled: true, state: "scheduled", schedule: { kind: "cron", expr: "0 2 * * *" }, next_run_at: iso(5 * HOUR), last_status: "ok" },
    { id: "j2", name: "Weekly report digest", enabled: true, state: "scheduled", schedule: { kind: "cron", expr: "0 9 * * 1" }, next_run_at: iso(52 * HOUR), last_status: "ok" },
    { id: "j3", name: "Sync release notes", enabled: true, state: "scheduled", schedule: { kind: "interval", minutes: 360 }, next_run_at: iso(2 * HOUR), last_status: "failed", last_error: "Source feed returned HTTP 503" },
    { id: "j4", name: "Archive finished cards", enabled: true, state: "scheduled", schedule: { kind: "cron", expr: "30 23 * * *" }, next_run_at: iso(9 * HOUR), last_status: "ok" },
    { id: "j5", name: "Index project docs", enabled: false, state: "paused", schedule: { kind: "interval", minutes: 1440 }, next_run_at: null, last_status: "ok" },
  ];
  const routes = {
    "/api/status": { auth_required: true, gateway_running: true, memory: { pressure: "ok" }, disk: { pressure: "ok" } },
    "/api/auth/providers": { providers: [{ name: "password", display_name: "Password", supports_password: true }] },
    "/api/auth/me": { user_id: "u-demo", display_name: "demo-operator", email: "", provider: "password", expires_at: Math.floor(now / 1000) + 30 * 86400 },
    "/api/auth/ws-ticket": { ticket: "demoticket0123456789abcdef", ttl_seconds: 60 },
    "/api/cron/jobs": jobs,
    "/api/plugins/kanban/stats": stats,
    "/api/plugins/kanban/workers/active": { count: 2 },
    "/api/plugins/kanban/diagnostics": { count: 1 },
    "/api/plugins/kanban/boards": { current: BOARD, boards: [
      { slug: BOARD, name: "Acme Web launch", description: "Work for the public launch", total: 14, is_current: true },
      { slug: "acme-api", name: "Acme API", description: "Orders and inventory", total: 9, is_current: false },
    ] },
    "/api/plugins/kanban/board": board,
  };
  const curl = async (argv) => {
    const url = new URL(argv[argv.length - 1]);
    const body = routes[url.pathname];
    const status = body === undefined ? 404 : 200;
    const text = body === undefined ? "" : JSON.stringify(body);
    return { stdout: "HTTP/1.1 " + status + " OK\r\nContent-Type: application/json\r\n\r\n" + text + "__ATUR_TERM_HERMES_STATUS__:" + status, stderr: "", exitCode: 0 };
  };
  // Own members of the mock host: the relay binds execAsync, which the lazy overrides do not support.
  h.base.exec = curl;
  h.base.execAsync = (argv) => ({ result: curl(argv), cancel: async () => {} });

  // ---- live gateway (WebSocket) ----------------------------------------------------------------
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  class FakeSocket extends EventTarget {
    static CONNECTING = 0; static OPEN = 1; static CLOSING = 2; static CLOSED = 3;
    constructor(url) {
      super();
      this.url = url;
      this.readyState = 0;
      setTimeout(() => { this.readyState = 1; this.dispatchEvent(new Event("open")); }, 20);
    }
    #emit(message) { this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(message) })); }
    #event(type, payload) { this.#emit({ jsonrpc: "2.0", method: "event", params: { type, session_id: "s-demo-1", payload } }); }
    send(raw) {
      const { id, method } = JSON.parse(raw);
      if (method === "session.create") setTimeout(() => this.#emit({ jsonrpc: "2.0", id, result: { session_id: "s-demo-1", stored_session_id: "stored-demo-1" } }), 30);
      else if (method === "prompt.submit") this.#script();
      else setTimeout(() => this.#emit({ jsonrpc: "2.0", id, result: {} }), 30);
    }
    async #script() {
      await sleep(80);
      this.#event("message.delta", { text: "I'll start with the cart summary component and its tests. " });
      await sleep(60);
      this.#event("tool.complete", { name: "read_file", summary: "Read src/checkout/CartSummary.tsx (214 lines)" });
      await sleep(60);
      this.#event("tool.complete", { name: "search_files", summary: "Found 3 tests that touch cart totals" });
      await sleep(60);
      this.#event("tool.progress", { name: "execute_code", preview: "Running the cart summary tests" });
      this.#event("approval.request", {
        description: "execute_code can read files and run code in the workspace.",
        command: "npm test -- CartSummary\npath: /workspace/acme-web\ntask: confirm totals update on quantity change",
      });
    }
    close() { this.readyState = 3; }
  }
  window.WebSocket = FakeSocket;

  // ---- scenes ------------------------------------------------------------------------------------
  const until = async (test) => { for (let i = 0; i < 150 && !test(); i += 1) await sleep(100); };
  window.addEventListener("load", async () => {
    const type = (selector, value) => {
      const input = document.querySelector(selector);
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };
    if (scene === "signin") {
      await until(() => document.querySelector("#dashboard-url"));
      type("#dashboard-url", BASE);
      await sleep(100);
      document.querySelector(".gateway-connect form button[type=submit]").click();
      await until(() => document.querySelector("#dashboard-username"));
      type("#dashboard-username", "demo-operator");
      type("#dashboard-password", "demo-password");
    } else if (scene === "board") {
      await until(() => document.querySelector(".board-card"));
      // Show Ready through Done, the columns that carry the work in flight.
      const columns = document.querySelector(".board-columns");
      const cols = document.querySelectorAll(".board-column");
      columns.scrollLeft = cols[3].getBoundingClientRect().left - cols[0].getBoundingClientRect().left;
    } else {
      await until(() => document.querySelector(".gateway-job-list") && document.querySelector(".gateway-connection-connected"));
      await sleep(500);
      if (scene === "run") {
        await until(() => document.querySelector("#agent-prompt") && !document.querySelector("#agent-prompt").disabled);
        type("#agent-prompt", "Review the cart summary tests and confirm the totals update when an item quantity changes.");
        document.querySelector(".gateway-composer-submit").click();
        await until(() => document.querySelector(".gateway-approval"));
      }
    }
    await sleep(500);
    window.__ready = true;
  });
})();
