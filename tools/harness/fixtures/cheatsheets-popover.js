// Popover: recents and favorites on the home view, then a search.
window.addEventListener("load", async () => {
  const { until, sleep, type } = window.__cs;
  await atur.storage.set("favorites", [{ source: "tldr", name: "git-stash" }, { source: "tldr", name: "docker" }, { source: "man", name: "tmux", section: "1" }]);
  await atur.storage.set("recents", [{ source: "tldr", name: "tar" }, { source: "man", name: "grep", section: "1" }, { source: "tldr", name: "jq" }]);
  await sleep(300);
  await type("git");
  await sleep(500);
  window.__ready = true;
});
