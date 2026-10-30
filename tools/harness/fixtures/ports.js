// Sample listening ports for the ports extension. The real background process scans with lsof
// and emits extension.ports.data; here the fixture plays that role.
(() => {
  const h = window.__harness;
  const records = [
    { port: 3000, pid: 41210, command: "node", cwd: "/home/dev/acme-web" },
    { port: 3001, pid: 41233, command: "vite", cwd: "/home/dev/acme-web/apps/admin" },
    { port: 6006, pid: 41502, command: "storybook", cwd: "/home/dev/acme-web" },
    { port: 8080, pid: 40871, command: "python3", cwd: "/home/dev/acme-api" },
    { port: 5432, pid: 40120, command: "postgres", cwd: "/home/dev/acme-api/db" },
    { port: 9229, pid: 40880, command: "node", cwd: "/home/dev/acme-api" },
    { port: 4000, pid: 42011, command: "bun", cwd: "/home/dev/docs-site" },
    { port: 5353, pid: 910, command: "avahi-daemon", cwd: "/var/run/avahi-daemon" },
    { port: 631, pid: 884, command: "cupsd", cwd: "/etc/cups" },
  ];
  h.set("projects.list", async () => [
    { id: "p1", name: "acme-web", path: "/home/dev/acme-web", isActive: true },
    { id: "p2", name: "acme-api", path: "/home/dev/acme-api" },
    { id: "p3", name: "docs-site", path: "/home/dev/docs-site" },
  ]);
  const events = window.atur.events;
  events.subscribe("extension.ports.request", () => events.emit("extension.ports.data", { records }));

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  window.addEventListener("load", async () => {
    for (let i = 0; i < 100 && document.querySelectorAll("button[title^='Stop port']").length < 7; i += 1) await sleep(100);
    await sleep(400);
    window.__ready = true;
  });
})();
