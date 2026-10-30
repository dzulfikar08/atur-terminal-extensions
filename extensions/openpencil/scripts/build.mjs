#!/usr/bin/env node
// Builds the extension: the OpenPencil web app at the pinned upstream commit, plus
// Atur Terminal's host script, assembled into dist/.
//
//   1. fetch the exact commit named in upstream.json (verified, never a moving ref)
//   2. apply patches/*.patch (small, reviewable; see README)
//   3. bun install --frozen-lockfile, build the workspace packages, vite build
//      (self-built apps send no telemetry: VITE_OPENPENCIL_FEEDBACK is never set)
//   4. copy the app into dist/, load src/atur-host.js before it, add licence notices
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeNotices } from "./notices.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const upstream = JSON.parse(fs.readFileSync(path.join(root, "upstream.json"), "utf8"));
const work = path.join(root, ".build", "open-pencil");
const dist = path.join(root, "dist");
const MAX_DIST_BYTES = 56 * 1024 * 1024; // the store accepts zips up to 64 MiB

const env = {
  ...process.env,
  GIT_LFS_SKIP_SMUDGE: "1",
  GIT_TERMINAL_PROMPT: "0",
  CI: "1",
};
delete env.VITE_OPENPENCIL_FEEDBACK;

function run(cmd, args, cwd, extraEnv = {}) {
  console.log(`$ ${cmd} ${args.join(" ")}`);
  execFileSync(cmd, args, { cwd, stdio: "inherit", env: { ...env, ...extraEnv } });
}

function capture(cmd, args, cwd) {
  return execFileSync(cmd, args, { cwd, env, encoding: "utf8" }).trim();
}

function fetchUpstream() {
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });
  run("git", ["init", "-q"], work);
  run("git", ["remote", "add", "origin", upstream.repository], work);
  run("git", ["fetch", "--depth", "1", "origin", upstream.commit], work);
  run("git", ["checkout", "-q", "--detach", "FETCH_HEAD"], work);
  const head = capture("git", ["rev-parse", "HEAD"], work);
  if (head !== upstream.commit) {
    throw new Error(`fetched ${head}, expected ${upstream.commit}`);
  }
}

function applyPatches() {
  const dir = path.join(root, "patches");
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".patch")).sort()) {
    run("git", ["apply", "--check", path.join(dir, file)], work);
    run("git", ["apply", path.join(dir, file)], work);
  }
}

function checkBun() {
  const version = capture("bun", ["--version"], root);
  if (version !== upstream.bun) {
    console.log(`::warning::bun ${version} is not the pinned ${upstream.bun}`);
  }
}

function buildApp() {
  checkBun();
  run("bun", ["install", "--frozen-lockfile"], work);
  run("bun", ["run", "build:packages"], work);
  run("bun", ["run", "vite", "build"], work);
  if (!fs.existsSync(path.join(work, "dist", "index.html"))) {
    throw new Error("the OpenPencil build produced no dist/index.html");
  }
}

function copyDir(from, to) {
  fs.cpSync(from, to, { recursive: true, dereference: true });
}

function assemble() {
  fs.rmSync(dist, { recursive: true, force: true });
  copyDir(path.join(work, "dist"), dist);

  // Pages and files of the hosted web app that make no sense inside the extension.
  for (const name of ["_headers", "_redirects", "oauth", "updater.html", "sw.js", "workbox-*.js", "registerSW.js", "manifest.webmanifest"]) {
    if (name.includes("*")) {
      const prefix = name.split("*")[0];
      for (const f of fs.readdirSync(dist)) if (f.startsWith(prefix)) fs.rmSync(path.join(dist, f), { force: true });
    } else {
      fs.rmSync(path.join(dist, name), { recursive: true, force: true });
    }
  }

  // Host script first, so its shims exist before the app's modules run.
  const indexPath = path.join(dist, "index.html");
  let html = fs.readFileSync(indexPath, "utf8");
  if (html.includes("atur-host.js")) throw new Error("index.html already loads atur-host.js");
  const hostTag = '<script src="/atur-host.js"></script>';
  html = html.replace(/<head>/i, `<head>\n    ${hostTag}`);
  if (!html.includes(hostTag)) throw new Error("could not add the host script to index.html");
  // The hosted app's PWA manifest does not apply inside Atur Terminal.
  html = html.replace(/<link[^>]+rel="manifest"[^>]*>\s*/gi, "");
  fs.writeFileSync(indexPath, html);

  fs.copyFileSync(path.join(root, "src", "atur-host.js"), path.join(dist, "atur-host.js"));
  fs.copyFileSync(path.join(root, "package.json"), path.join(dist, "package.json"));
  copyDir(path.join(root, "public", "marketplace"), path.join(dist, "marketplace"));
  fs.copyFileSync(path.join(root, "LICENSE-OpenPencil"), path.join(dist, "LICENSE-OpenPencil"));
  writeNotices(work, path.join(dist, "THIRD_PARTY_NOTICES.txt"));
  fs.writeFileSync(
    path.join(dist, "UPSTREAM.txt"),
    `OpenPencil ${upstream.tag} (${upstream.commit})\n${upstream.repository}\n` +
      `Built with the patches in patches/ of the extension source.\n`,
  );
}

function assertNoTelemetry() {
  // Self-built apps never send the daily ping or usage stats: the build flag is absent.
  const offenders = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(js|html)$/.test(entry.name)) {
        const text = fs.readFileSync(full, "utf8");
        if (/VITE_OPENPENCIL_FEEDBACK/.test(text)) offenders.push(path.relative(dist, full));
      }
    }
  })(dist);
  if (offenders.length) {
    throw new Error(`telemetry build flag referenced in: ${offenders.join(", ")}`);
  }
}

function report() {
  const files = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else files.push({ file: path.relative(dist, full), size: fs.statSync(full).size });
    }
  })(dist);
  files.sort((a, b) => b.size - a.size);
  const total = files.reduce((sum, f) => sum + f.size, 0);
  console.log(`dist: ${files.length} files, ${(total / 1048576).toFixed(1)} MiB`);
  for (const f of files.slice(0, 12)) console.log(`  ${(f.size / 1048576).toFixed(2)} MiB  ${f.file}`);
  if (total > MAX_DIST_BYTES) throw new Error(`dist is ${total} bytes; the limit is ${MAX_DIST_BYTES}`);
  const digest = crypto.createHash("sha256");
  for (const f of files.map((x) => x.file).sort()) digest.update(f).update(fs.readFileSync(path.join(dist, f)));
  console.log(`dist content sha256 ${digest.digest("hex")}`);
}

if (!process.env.OPENPENCIL_REUSE_BUILD) {
  fetchUpstream();
  applyPatches();
  buildApp();
}
assemble();
assertNoTelemetry();
report();
