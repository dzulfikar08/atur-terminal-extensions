// Sample Ollama servers and models for the ollama panel: curl and `ollama launch --help` served through atur.exec.
(() => {
  const h = window.__harness;
  const servers = [
    { id: "srv_local", name: "Local", url: "http://127.0.0.1:11434", createdAt: Date.now() },
    { id: "srv_gpu", name: "GPU box", url: "http://192.168.1.49:11434", createdAt: Date.now() },
  ];
  const GB = 1024 ** 3;
  const tags = {
    "http://127.0.0.1:11434": [
      { name: "llama3.2:3b", size: 2.0 * GB, details: { parameter_size: "3.2B", quantization_level: "Q4_K_M" } },
      { name: "qwen2.5-coder:7b", size: 4.7 * GB, details: { parameter_size: "7.6B", quantization_level: "Q4_K_M" } },
      { name: "gemma3:4b", size: 3.3 * GB, details: { parameter_size: "4.3B", quantization_level: "Q4_K_M" } },
      { name: "nomic-embed-text:latest", size: 0.27 * GB, details: { parameter_size: "137M", quantization_level: "F16" } },
      { name: "mistral:7b", size: 4.1 * GB, details: { parameter_size: "7.2B", quantization_level: "Q4_0" } },
    ],
    "http://192.168.1.49:11434": [
      { name: "qwen2.5-coder:32b", size: 19.9 * GB, details: { parameter_size: "32.8B", quantization_level: "Q4_K_M" } },
      { name: "llama3.3:70b", size: 42.5 * GB, details: { parameter_size: "70.6B", quantization_level: "Q4_K_M" } },
    ],
  };
  const help = [
    "Launch an integration with Ollama",
    "",
    "Supported integrations:",
    "  claude    Claude Code",
    "  codex     Codex",
    "  opencode  OpenCode",
    "  droid     Droid",
    "",
    "Examples:",
    "  ollama launch claude",
    "",
  ].join("\n");

  h.base.storage.set("servers", servers);
  h.base.storage.set("defaults", { serverId: "srv_local", agent: "claude", extraArgs: "", modelsByServer: { srv_local: "qwen2.5-coder:7b", srv_gpu: "qwen2.5-coder:32b" } });
  h.set("exec", async (argv) => {
    const ok = (stdout) => ({ stdout, stderr: "", exitCode: 0 });
    if (argv[0] === "ollama") return ok(help);
    const url = String(argv[argv.length - 1]);
    const base = Object.keys(tags).find((b) => url.startsWith(b));
    if (!base) return { stdout: "", stderr: "", exitCode: 7 };
    if (url.endsWith("/api/version")) return ok(JSON.stringify({ version: "0.12.6" }));
    if (url.endsWith("/api/tags")) return ok(JSON.stringify({ models: tags[base] }));
    return ok("");
  });

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  window.addEventListener("load", async () => {
    for (let i = 0; i < 100 && document.querySelectorAll("button").length < 4; i += 1) await sleep(100);
    await sleep(1500);
    window.__ready = true;
  });
})();
