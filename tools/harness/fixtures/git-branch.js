// Source Control panel, Branch tab: a commit message typed over staged and unstaged changes.
window.addEventListener("load", async () => {
  const { sleep, until } = window.__harness.git;
  await until(() => document.querySelector("textarea") && document.body.textContent.includes("Staged Changes"));
  const area = document.querySelector("textarea");
  area.value = "Add GitHub OAuth login flow";
  area.dispatchEvent(new Event("input", { bubbles: true }));
  await sleep(600);
  window.__ready = true;
});
