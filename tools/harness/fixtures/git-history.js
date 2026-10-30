// Source Control panel, History tab: the commit graph with merges, tags and branch labels.
window.addEventListener("load", async () => {
  const { sleep, until, tabButton } = window.__harness.git;
  await until(() => tabButton("History"));
  tabButton("History").click();
  await until(() => document.body.textContent.includes("Set up CI pipeline"));
  await sleep(600);
  window.__ready = true;
});
