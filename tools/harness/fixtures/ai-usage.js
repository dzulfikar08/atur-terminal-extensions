// Sample usage data for the ai-usage popover, injected through its documented localStorage fixture.
(() => {
  const inHours = (h) => new Date(Date.now() + h * 3600 * 1000).toISOString();
  const providers = [
    { id: "claude", state: "available", planName: "Max", rows: [
      { label: "Session (5h)", percent: 42, resetAt: inHours(2.5), periodDuration: 5 * 3600 },
      { label: "Weekly", percent: 63, resetAt: inHours(70), periodDuration: 7 * 24 * 3600 },
      { label: "Weekly Opus", percent: 88, resetAt: inHours(70), periodDuration: 7 * 24 * 3600 },
    ] },
    { id: "codex", state: "available", planName: "Plus", rows: [
      { label: "Session", percent: 17, resetAt: inHours(3.2), periodDuration: 5 * 3600 },
      { label: "Weekly", percent: 35, resetAt: inHours(96), periodDuration: 7 * 24 * 3600 },
    ] },
    { id: "cursor", state: "available", planName: "Pro", rows: [
      { label: "Requests", percent: 54, detail: "270/500", resetAt: inHours(190), periodDuration: 30 * 24 * 3600 },
    ] },
    { id: "openrouter", state: "available", planName: "Credits", rows: [
      { label: "Credits", percent: 28, detail: "$14.00/$50.00" },
    ] },
  ];
  localStorage.setItem("ai-usage.fixture", JSON.stringify({ providers }));
  localStorage.setItem("ai-usage.tracked", JSON.stringify(providers.map((p) => p.id)));
  localStorage.setItem("ai-usage.providerEnabled", JSON.stringify(providers.map((p) => p.id)));
  localStorage.setItem("ai-usage.catalogSig", [
    "alibaba", "amp", "antigravity", "claude", "codex", "copilot", "cursor", "devin", "factory", "grok",
    "kimi", "minimax", "opencode-go", "openrouter", "zai",
  ].join(","));
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  window.addEventListener("load", async () => {
    for (let i = 0; i < 100 && !document.querySelector(".metric"); i += 1) await sleep(100);
    await sleep(400);
    window.__ready = true;
  });
})();
