// Sample data for todos: one project with a populated list kept in storage under todos:<projectID>.
(() => {
  const h = window.__harness;
  const now = Date.now();
  const hrs = (n) => now - n * 3600 * 1000;

  h.set("projects.list", async () => [
    { id: "p1", name: "acme-web", path: "/home/dev/acme-web", isActive: true },
    { id: "p2", name: "acme-api", path: "/home/dev/acme-api", isActive: false },
  ]);
  h.set("dialog.confirm", async () => "Cancel");

  const t = (id, text, extra = {}) => ({ id, text, note: "", done: false, createdAt: hrs(5), completedAt: null, ...extra });
  h.memory.set("todos:p1", [
    t("t1", "Fix flaky checkout test on slow CI runners", { priority: "#FF0000", note: "Fails ~1 in 8 runs. Likely the cart animation timing." }),
    t("t2", "Review OAuth login pull request", { priority: "#FF7A00" }),
    t("t3", "Lazy-load dashboard chart widgets", { priority: "#2196F3", createdAt: hrs(20) }),
    t("t4", "Document required environment variables", { priority: "#00C853", createdAt: hrs(26) }),
    t("t5", "Replace moment.js with date-fns", { createdAt: hrs(30), note: "Start with the date formatting helpers in src/lib/dates." }),
    t("t6", "Add dark mode toggle to settings", { createdAt: hrs(48), priority: "#9C27B0" }),
    t("t7", "Upgrade to Node 22 and refresh lockfile", { done: true, completedAt: hrs(2), createdAt: hrs(50) }),
    t("t8", "Write release notes for 2.4", { done: true, completedAt: hrs(6), createdAt: hrs(60) }),
    t("t9", "Rotate staging API keys", { done: true, completedAt: hrs(22), createdAt: hrs(70) }),
  ]);

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const until = async (test) => { for (let i = 0; i < 100 && !test(); i += 1) await sleep(100); };
  window.addEventListener("load", async () => {
    await until(() => document.querySelector("#root input, #root textarea") && document.body.textContent.includes("Fix flaky"));
    await sleep(500);
    window.__ready = true;
  });
})();
