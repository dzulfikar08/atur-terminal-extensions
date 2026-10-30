// Popover: reading a tldr page.
window.addEventListener("load", async () => {
  const { until, sleep, type } = window.__cs;
  await sleep(300);
  await type("docker");
  document.querySelector("#results .row").click();
  await until(() => document.querySelector(".example"));
  await sleep(500);
  window.__ready = true;
});
