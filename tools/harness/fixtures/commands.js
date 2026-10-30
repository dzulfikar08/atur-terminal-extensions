// Sample pinned commands for the commands extension (stored in localStorage by the extension itself).
(() => {
  const cmds = [
    { id: "claude", name: "Claude", command: "claude", icon: "../icons/claude.svg", cwd: "" },
    { id: "codex", name: "Codex", command: "codex", icon: "../icons/codex.svg", cwd: "" },
    { id: "dev", name: "Dev server", command: "npm run dev", icon: "rocket", cwd: "apps/web" },
    { id: "test", name: "Run tests", command: "npm test -- --watch", icon: "tube", cwd: "" },
    { id: "logs", name: "Tail logs", command: "tail -f logs/app.log", icon: "file", cwd: "" },
    { id: "db", name: "Database shell", command: "psql acme_dev", icon: "database", cwd: "" },
  ];
  try { localStorage.setItem("atur-launcher:commands", JSON.stringify(cmds)); } catch (_) { /* ignore */ }
  window.addEventListener("load", () => setTimeout(() => { window.__ready = true; }, 600));
})();
