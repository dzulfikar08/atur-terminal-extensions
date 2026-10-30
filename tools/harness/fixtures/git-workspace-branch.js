window.addEventListener("load", async () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const until = async (test) => { for (let i = 0; i < 100 && !test(); i += 1) await sleep(100); };
  await until(() => document.querySelector("textarea") && document.body.textContent.includes("Staged Changes"));
  const area = document.querySelector("textarea");
  area.value = "Add rate limiting to the public API";
  area.dispatchEvent(new Event("input", { bubbles: true }));
  await sleep(600);
  window.__ready = true;
});
