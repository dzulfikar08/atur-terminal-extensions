// Source Control panel, PRs tab: the current branch's pull request and the open PR list.
window.addEventListener("load", async () => {
  const { sleep, until, tabButton } = window.__harness.git;
  await until(() => tabButton("PRs"));
  tabButton("PRs").click();
  await until(() => tabButton("Load pull requests"));
  tabButton("Load pull requests").click();
  await until(() => document.body.textContent.includes("#115"));
  await sleep(600);
  window.__ready = true;
});
