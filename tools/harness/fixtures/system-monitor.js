// Sample data for system-monitor: stands in for the background sampler by answering
// extension.mon.* events with a believable machine snapshot.
(() => {
  const h = window.__harness;
  const GB = 1024 ** 3;
  const MB = 1024 ** 2;

  h.memory.set("onboarded", true);

  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const series = (n, base, amp, floor = 0) => {
    const out = [];
    let v = base;
    for (let i = 0; i < n; i += 1) {
      v = Math.max(floor, Math.min(base + amp * 2, v + (rnd() - 0.5) * amp));
      out.push(v);
    }
    return out;
  };

  const history = {
    cpu: series(120, 32, 22, 4),
    gpu: [],
    down: series(120, 900 * 1024, 700 * 1024, 20 * 1024),
    up: series(120, 140 * 1024, 120 * 1024, 4 * 1024),
  };

  const snapshot = {
    at: Date.now(), os: "linux", stale: false,
    cpu: { usage: 37.4 },
    loadavg: [2.31, 2.08, 1.84],
    mem: { usedB: 11.2 * GB, totalB: 32 * GB, appB: 7.9 * GB, wiredB: 2.1 * GB, compressedB: 1.2 * GB },
    swap: { usedB: 640 * MB, totalB: 4 * GB },
    net: { downBps: 1.6 * MB, upBps: 212 * 1024 },
    gpu: null,
    power: { battery: { percent: 78, state: "discharging", remaining: "4:12" } },
    disk: { usedB: 412 * GB, sizeB: 931 * GB, pct: 44.3 },
  };

  const config = {
    sections: { cpu: true, gpu: true, mem: true, net: true, power: true, disk: true, top: true },
  };
  const status = { paused: false, denied: {}, warn: {} };

  const procs = [
    ["node (vite dev)", 24.8, 612 * MB], ["rust-analyzer", 17.2, 1.4 * GB], ["Chromium", 12.6, 980 * MB],
    ["tsserver", 9.3, 540 * MB], ["postgres", 4.1, 228 * MB], ["docker", 3.7, 396 * MB],
    ["atur-terminal", 2.9, 310 * MB], ["pipewire", 1.2, 42 * MB], ["gnome-shell", 0.9, 288 * MB],
    ["sshd", 0.1, 8 * MB],
  ].map(([name, cpu, rssB], i) => ({ pid: 1200 + i * 37, name, cpu, rssB: Math.round(rssB) }));

  h.set("dialog.confirm", async () => "Cancel");

  const sub = window.atur.events.subscribe;
  sub("extension.mon.hello", () => setTimeout(() => {
    h.emit("extension.mon.state", { config, history, snapshot, status });
    h.emit("extension.mon.procsResult", { denied: false, procs });
  }, 30));

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const until = async (test) => { for (let i = 0; i < 100 && !test(); i += 1) await sleep(100); };
  window.addEventListener("load", async () => {
    await until(() => document.querySelector(".proc-row"));
    await sleep(600);
    window.__ready = true;
  });
})();
