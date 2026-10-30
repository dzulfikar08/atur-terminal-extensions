#!/usr/bin/env node
// Runs harness cases: node tools/harness/run.mjs [case ...]
// Each case file in cases/ names an extension, its entry page, fixtures, and the wait condition.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const outDir = path.join(here, "out");
fs.mkdirSync(outDir, { recursive: true });

const requested = process.argv.slice(2);
const names = fs
  .readdirSync(path.join(here, "cases"))
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(/\.json$/, ""))
  .filter((n) => requested.length === 0 || requested.includes(n));

let failed = 0;
for (const name of names) {
  const spec = JSON.parse(fs.readFileSync(path.join(here, "cases", `${name}.json`), "utf8"));
  const args = [
    "-a", "--server-args=-screen 0 1920x1200x24",
    "python3", path.join(here, "harness.py"),
    "--root", path.join(root, "extensions", spec.extension, "dist"),
    "--owner", spec.extension,
    "--entry", spec.entry ?? "index.html",
    "--out", path.join(outDir, `${name}.png`),
    "--report", path.join(outDir, `${name}.json`),
    "--width", String(spec.width ?? 1280),
    "--height", String(spec.height ?? 800),
    "--theme", spec.theme ?? "dark",
  ];
  if (spec.wait) args.push("--wait", spec.wait);
  if (spec.settle != null) args.push("--settle", String(spec.settle));
  if (spec.timeout != null) args.push("--timeout", String(spec.timeout));
  if (spec.data !== undefined) args.push("--data", JSON.stringify(spec.data));
  for (const f of spec.fixtures ?? []) args.push("--fixture", path.join(here, "fixtures", f));
  for (const [k, v] of Object.entries(spec.assets ?? {})) args.push("--assets", `${k}=${path.resolve(root, v)}`);
  for (const e of spec.eval ?? []) args.push("--eval", e);
  console.log(`\n=== ${name}`);
  const result = spawnSync("xvfb-run", args, { stdio: "inherit", env: { ...process.env, LIBGL_ALWAYS_SOFTWARE: "1", WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS: "1" } });
  if (result.status === 0 && spec.compose) {
    const c = spec.compose;
    const composed = spawnSync(
      "python3",
      [
        path.join(here, "compose.py"),
        path.join(outDir, `${name}.png`),
        path.join(outDir, `${name}.listing.png`),
        "--canvas", c.canvas ?? "1600x1000",
        "--mode", c.mode ?? "center",
        ...(c.bg ? ["--bg", c.bg] : []),
      ],
      { stdio: "inherit" },
    );
    if (composed.status !== 0) result.status = composed.status;
  }
  if (result.status !== 0) {
    failed += 1;
    console.log(`::error::harness case ${name} failed (exit ${result.status})`);
  }
}
if (failed > 0) process.exit(1);
