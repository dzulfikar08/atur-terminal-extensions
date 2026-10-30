// The tab view: Mine on the left; an issue's detail with the Need Review evidence composer on the right.
(() => {
  const h = window.__harness;
  window.addEventListener("load", async () => {
    await h.until(() => document.querySelector('.row[data-id="i-12"]'));
    document.querySelector('.row[data-id="i-12"]').click();
    await h.until(() => document.querySelector(".comment"));
    document.querySelector('[data-action="open-composer"][data-composer="review"]').click();
    await h.until(() => document.querySelector('textarea[data-field="output"]')?.value.includes("61 pass"));
    const summary = document.querySelector('input[data-field="summary"]');
    summary.value = "Sidebar panel, tab view and review flow done";
    summary.dispatchEvent(new Event("input", { bubbles: true }));
    await h.sleep(600);
    window.__ready = true;
  });
})();
