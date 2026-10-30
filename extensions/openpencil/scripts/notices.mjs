import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// Writes THIRD_PARTY_NOTICES.txt: every package reachable from the app's runtime
// dependencies, with its licence, then each distinct licence text once.

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function findPackage(name, fromDir) {
  let dir = fs.realpathSync(fromDir);
  for (;;) {
    const candidate = path.join(dir, "node_modules", name, "package.json");
    if (fs.existsSync(candidate)) return fs.realpathSync(path.dirname(candidate));
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function licenseOf(pkg) {
  const l = pkg.license ?? pkg.licenses;
  if (typeof l === "string") return l;
  if (l && typeof l === "object" && !Array.isArray(l)) return l.type ?? "UNKNOWN";
  if (Array.isArray(l)) return l.map((x) => x.type ?? x).join(" OR ");
  return "UNKNOWN";
}

function licenseText(dir) {
  for (const name of fs.readdirSync(dir)) {
    if (/^(licen[cs]e|copying|notice)(\.|$)/i.test(name)) {
      const file = path.join(dir, name);
      if (fs.statSync(file).isFile()) return fs.readFileSync(file, "utf8").trim();
    }
  }
  return null;
}

export function writeNotices(appRoot, outFile) {
  const rootPkg = readJSON(path.join(appRoot, "package.json"));
  const seen = new Map();
  const queue = Object.keys(rootPkg.dependencies ?? {}).map((name) => ({ name, from: appRoot }));
  while (queue.length) {
    const { name, from } = queue.pop();
    const dir = findPackage(name, from);
    if (!dir || seen.has(dir)) continue;
    const pkg = readJSON(path.join(dir, "package.json"));
    seen.set(dir, { name: pkg.name ?? name, version: pkg.version ?? "", license: licenseOf(pkg), dir });
    for (const dep of Object.keys(pkg.dependencies ?? {})) queue.push({ name: dep, from: dir });
    for (const dep of Object.keys(pkg.optionalDependencies ?? {})) queue.push({ name: dep, from: dir });
  }
  const entries = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
  const texts = new Map();
  const lines = [
    "Third-party software bundled with the OpenPencil extension",
    "==========================================================",
    "",
    "OpenPencil itself is MIT licensed (see LICENSE-OpenPencil). The packages below are",
    "reachable from its runtime dependencies; each is covered by the licence shown.",
    "",
  ];
  for (const e of entries) {
    lines.push(`${e.name}@${e.version}  ${e.license}`);
    const text = licenseText(e.dir);
    if (text) {
      const key = crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
      if (!texts.has(key)) texts.set(key, { text, names: [] });
      texts.get(key).names.push(`${e.name}@${e.version}`);
    }
  }
  lines.push("", "", "Licence texts", "=============", "");
  for (const { text, names } of texts.values()) {
    lines.push(`--- ${names.slice(0, 6).join(", ")}${names.length > 6 ? `, and ${names.length - 6} more` : ""}`, "", text, "", "");
  }
  fs.writeFileSync(outFile, lines.join("\n"));
  console.log(`notices: ${entries.length} packages, ${texts.size} distinct licence texts`);
}
