import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

export const repoRoot = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const extensionsDir = path.join(repoRoot, "extensions");

// The manifest schema is vendored in `schema/manifest.schema.json`. It mirrors
// docs/extensions/schema/manifest.schema.json in the Atur Terminal app repo
// (dzulfikar08/atur-terminal); update it here when the app's schema changes.
export const schemaPath = path.join(repoRoot, "schema", "manifest.schema.json");

export async function fetchSchema() {
  return readJSON(schemaPath);
}

export function listExtensionNames() {
  if (!fs.existsSync(extensionsDir)) return [];
  return fs
    .readdirSync(extensionsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort();
}

export function extensionDir(name) {
  return path.join(extensionsDir, name);
}

export function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

// The manifest file an extension ships. The Atur Terminal manifest lives under the
// `atur` key of the npm `package.json`; identity (`name`, `version`) and the
// required `build` script live at the top level where npm expects them.
export const manifestFileName = "package.json";

// Directory (relative to an extension) that the Vite build emits and that gets
// packed and signed.
export const buildOutputDir = "dist";

export function packageJSONPath(dir) {
  return path.join(dir, manifestFileName);
}

// Reads an extension's package.json and returns its parts. `atur` is the
// manifest body (everything that used to live in manifest.json). `manifest` is
// a flattened view (top-level name/version merged into the atur fields) so the
// existing validate/pack/publish logic can keep reading `manifest.popovers`,
// `manifest.permissions`, etc.
export function readPackageManifest(dir) {
  const pkg = readJSON(packageJSONPath(dir));
  const atur = pkg["atur-terminal"] ?? {};
  return {
    name: pkg.name,
    version: pkg.version,
    scripts: pkg.scripts ?? {},
    atur,
    manifest: { ...atur, name: pkg.name, version: pkg.version },
  };
}

function iconSVGPath(icon) {
  if (icon && typeof icon === "object" && typeof icon.svg === "string") return icon.svg;
  return null;
}

// The set of files (paths relative to the build output) that the atur block
// references and that therefore must exist in `dist/` after a build: entries,
// background script, icons, and marketplace listing assets.
export function referencedBuildFiles(atur) {
  const files = new Set();
  if (atur.background) files.add(atur.background);
  for (const tab of atur.tabTypes ?? []) if (tab.entry) files.add(tab.entry);
  for (const panel of atur.panels ?? []) {
    if (panel.entry) files.add(panel.entry);
    const svg = iconSVGPath(panel.icon);
    if (svg) files.add(svg);
  }
  for (const popover of atur.popovers ?? []) if (popover.entry) files.add(popover.entry);
  for (const command of atur.commands ?? []) {
    if (command.action?.kind === "runScript" && command.action.script) {
      files.add(command.action.script);
    }
  }
  for (const item of atur.topbarItems ?? []) {
    const svg = iconSVGPath(item.icon);
    if (svg) files.add(svg);
  }
  for (const item of atur.statusBarItems ?? []) {
    const svg = iconSVGPath(item.icon);
    if (svg) files.add(svg);
  }
  const market = atur.marketplace ?? {};
  if (market.icon) files.add(market.icon);
  for (const shot of market.screenshots ?? []) files.add(shot);
  return [...files];
}

export function resolveInside(baseDir, relative) {
  const resolved = path.resolve(baseDir, relative);
  const normalizedBase = path.resolve(baseDir) + path.sep;
  const inside = resolved === path.resolve(baseDir) || resolved.startsWith(normalizedBase);
  return { resolved, inside };
}
