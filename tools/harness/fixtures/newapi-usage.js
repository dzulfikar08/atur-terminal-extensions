// Sample sites and cached balances for the newapi-usage popover, seeded through atur.storage.
(() => {
  const now = new Date();
  const sites = [
    { id: "s1", type: "newapi", name: "Acme Gateway", apiUrl: "https://newapi.acme.example", accessToken: "sk-sample", userId: "12", enabled: true },
    { id: "s2", type: "newapi", name: "Team Relay", apiUrl: "https://relay.example.com", accessToken: "sk-sample", userId: "7", enabled: true },
    { id: "s3", type: "newapi", name: "Staging Proxy", apiUrl: "https://proxy.staging.example", accessToken: "sk-sample", userId: "3", enabled: true },
    { id: "s4", type: "sub2api", name: "Sub Pool A", apiUrl: "https://sub.example.com", accessToken: "sk-sample", enabled: true },
    { id: "s5", type: "sub2api", name: "Sub Pool B", apiUrl: "https://sub2.example.com", accessToken: "sk-sample", enabled: true },
  ];
  const fetchedAt = now.toISOString();
  const cache = {
    version: 1,
    autoRefreshSeconds: 300,
    balAlert: 5,
    lastPollAt: fetchedAt,
    sites: [
      { id: "s1", type: "newapi", name: "Acme Gateway", apiUrl: sites[0].apiUrl, fetchedAt, balanceUsd: 86.42, todayUsageUsd: 3.17, totalUsedUsd: 213.8, requestCount: 5120, group: "default", error: null },
      { id: "s2", type: "newapi", name: "Team Relay", apiUrl: sites[1].apiUrl, fetchedAt, balanceUsd: 23.05, todayUsageUsd: 1.62, totalUsedUsd: 76.9, requestCount: 1834, group: "vip", error: null },
      { id: "s3", type: "newapi", name: "Staging Proxy", apiUrl: sites[2].apiUrl, fetchedAt, balanceUsd: 2.38, todayUsageUsd: 0.41, totalUsedUsd: 47.6, requestCount: 902, group: "default", error: null },
      { id: "s4", type: "sub2api", name: "Sub Pool A", apiUrl: sites[3].apiUrl, fetchedAt, remaining: 41.9, unit: "USD", isValid: true, error: null },
      { id: "s5", type: "sub2api", name: "Sub Pool B", apiUrl: sites[4].apiUrl, fetchedAt, remaining: 12.75, unit: "USD", isValid: true, error: null },
    ],
  };
  window.atur.storage.set("newapi-sites", JSON.stringify(sites));
  window.atur.storage.set("newapi-status", JSON.stringify(cache));
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  window.addEventListener("load", async () => {
    for (let i = 0; i < 100 && document.querySelectorAll(".list-row").length < 5; i += 1) await sleep(100);
    await sleep(800);
    window.__ready = true;
  });
})();
