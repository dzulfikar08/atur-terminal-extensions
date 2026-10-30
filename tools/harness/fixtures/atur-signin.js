// Not signed in: the sign-in screen.
(() => {
  const h = window.__harness;
  h.base.panelID = "atur";
  h.memory.delete("auth");
  window.addEventListener("load", async () => {
    await h.until(() => document.querySelector(".signin"));
    await h.sleep(300);
    window.__ready = true;
  });
})();
