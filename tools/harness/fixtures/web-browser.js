// Navigates the browser tab to a local sample docs page served as a harness asset.
window.addEventListener("load", async () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const input = document.getElementById("url-input");
  input.value = "atur-ext://web-browser/__fixtures__/docs.html";
  document.getElementById("url-form").requestSubmit();
  const frame = document.getElementById("browser-frame");
  for (let i = 0; i < 100 && !frame.classList.contains("is-visible"); i += 1) await sleep(100);
  await sleep(800);
  input.value = "https://docs.acme.dev/local-development";
  input.blur();
  window.__ready = true;
});
