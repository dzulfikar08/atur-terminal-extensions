// Lookup modal: type "tar", open the tldr page.
window.addEventListener("load", async () => {
  const { until, sleep, type } = window.__cs;
  await sleep(300);
  await type("tar");
  document.querySelector("#results .row").click();
  await until(() => document.querySelector(".example"));
  await sleep(500);
  window.__ready = true;
});
