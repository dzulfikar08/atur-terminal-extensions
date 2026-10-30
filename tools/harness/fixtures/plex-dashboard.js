// Sample Plex Media Server for the plex-dashboard extension: curl calls served through atur.exec.
(() => {
  const h = window.__harness;
  try {
    localStorage.setItem("plex-dashboard:token", "sample-token");
    localStorage.setItem("plex-dashboard:prefs", JSON.stringify({ clientId: "3f1c2b7a-5d1e-4c0b-9a64-0d2f7e8b1a10", refreshIntervalSec: 30 }));
  } catch (_) { /* ignore */ }

  const BASE = "http://192.168.1.20:32400";
  const min = (m) => m * 60 * 1000;
  const sess = (key, o) => ({
    sessionKey: String(key),
    Session: { id: "sess-" + key, bandwidth: o.bw, location: o.loc || "lan" },
    Player: { title: o.device, product: "Plex", address: o.addr || "192.168.1.5", state: o.state || "playing" },
    User: { title: o.user },
    Media: [{ bitrate: o.bitrate }],
    TranscodeSession: o.transcode ? { videoDecision: "transcode", audioDecision: "copy" } : undefined,
    type: o.type, title: o.title, grandparentTitle: o.show, duration: o.dur, viewOffset: o.off,
  });
  const sessions = [
    sess(3, { type: "movie", title: "Northern Lights", user: "maya", device: "Living Room TV", bw: 18200, bitrate: 24000, dur: min(128), off: min(47), transcode: true }),
    sess(4, { type: "episode", show: "The Long Harbor", title: "S02E05 Low Tide", user: "leo", device: "iPhone", bw: 4100, bitrate: 6000, dur: min(52), off: min(31), loc: "wan", transcode: true, addr: "203.0.113.24" }),
    sess(2, { type: "episode", show: "Orbit Station", title: "S01E08 Docking", user: "priya", device: "Chrome", bw: 9800, bitrate: 9800, dur: min(44), off: min(12), state: "paused" }),
    sess(1, { type: "movie", title: "Paper Kingdoms", user: "sam", device: "Apple TV", bw: 14500, bitrate: 14500, dur: min(104), off: min(88) }),
  ];

  const exec = async (argv) => {
    const url = String(argv[argv.length - 1]);
    const out = (obj) => ({ stdout: JSON.stringify(obj) + "\n200", stderr: "", exitCode: 0 });
    if (url.includes("plex.tv/api/v2/resources")) {
      return out([{ name: "acme-media", provides: "server", owned: true, clientIdentifier: "srv-acme-media", productVersion: "1.41.3.9314", platform: "Linux", connections: [{ uri: BASE, local: true, relay: false }] }]);
    }
    if (url.endsWith("/identity")) return out({ MediaContainer: { machineIdentifier: "srv-acme-media" } });
    if (url.includes("/statistics/resources")) return out({ MediaContainer: { StatisticsResources: [{ hostCpuUtilization: 48.2, hostMemoryUtilization: 62.4, processCpuUtilization: 21, processMemoryUtilization: 8 }] } });
    if (url.includes("/status/sessions")) return out({ MediaContainer: { size: sessions.length, Metadata: sessions } });
    if (url === BASE + "/" ) return out({ MediaContainer: { friendlyName: "acme-media", version: "1.41.3.9314", platform: "Linux", machineIdentifier: "srv-acme-media" } });
    return out({});
  };
  // The extension calls atur.exec.bind(...), which the lazy mock would treat as another call; expose a real function.
  const real = window.atur;
  window.atur = new Proxy(real, { get: (target, prop) => (prop === "exec" ? exec : target[prop]) });

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  window.addEventListener("load", async () => {
    for (let i = 0; i < 100 && document.querySelectorAll(".session").length < sessions.length; i += 1) await sleep(100);
    await sleep(500);
    window.__ready = true;
  });
})();
