// Agents needing you: the Agents view in a tab, with the workspace switcher open.
(() => {
  const h = window.__harness;
  window.addEventListener("load", async () => {
    await h.until(() => document.querySelector('[data-action="set-view"][data-view="agents"]'));
    document.querySelector('[data-action="set-view"][data-view="agents"]').click();
    await h.until(() => document.querySelectorAll(".row").length >= 2);
    document.querySelector('[data-action="toggle-menu"][data-menu="workspace"]').click();
    await h.until(() => document.querySelectorAll(".menu img.wsicon").length >= 3);
    await h.sleep(500);
    window.__ready = true;
  });
})();
