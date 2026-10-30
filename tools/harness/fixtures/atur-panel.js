// The sidebar panel: the active terminal's linked issue above My issues, across workspaces.
(() => {
  const h = window.__harness;
  h.base.panelID = "atur";
  window.addEventListener("load", async () => {
    await h.until(() => document.querySelectorAll(".row").length >= 4 && document.querySelector(".linked__name") && document.querySelectorAll("img.wsicon").length >= 0);
    await h.sleep(600);
    window.__ready = true;
  });
})();
