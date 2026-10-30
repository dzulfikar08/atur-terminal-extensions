import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { buildOutputDir, extensionDir, packageJSONPath, readPackageManifest, readJSON, repoRoot } from "./lib/paths.mjs";
import { publicKeyFor, readPublicKey, signBytes, verifyBytes } from "./lib/sign.mjs";
import { packExtension } from "./pack.mjs";

const UPLOAD_URL = process.env.EXTENSIONS_PUBLISH_URL || "https://extensions.diatur.com/api/publish";
const TOKEN = (process.env.EXTENSIONS_PUBLISH_TOKEN || "").trim();
const SECRET_KEY = (process.env.EXTENSIONS_SIGNING_KEY || "").trim();
const PUBLISHER = process.env.GITHUB_REPOSITORY || "dzulfikar08/atur-terminal-extensions";
const DRY_RUN = process.argv.includes("--dry-run");

const firstParty = new Set(readJSON(path.join(repoRoot, "first-party.json")).extensions);

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

function sign(bytes) {
  return signBytes(bytes, SECRET_KEY);
}

const CONTENT_TYPES = { ".svg": "image/svg+xml", ".png": "image/png" };

function listingAsset(dir, field, relative) {
  const data = fs.readFileSync(path.join(dir, relative));
  const ext = path.extname(relative).toLowerCase();
  return {
    field,
    path: relative,
    filename: path.basename(relative),
    contentType: CONTENT_TYPES[ext] ?? "application/octet-stream",
    sha256: crypto.createHash("sha256").update(data).digest("hex"),
    data,
  };
}

function collectListingAssets(name) {
  // Listing assets live in the build output (Vite emits them into dist/).
  const distDir = path.join(extensionDir(name), buildOutputDir);
  const market = readPackageManifest(extensionDir(name)).atur.marketplace ?? {};
  const assets = [];
  if (market.icon) assets.push(listingAsset(distDir, "icon", market.icon));
  (market.screenshots ?? []).forEach((shot, index) =>
    assets.push(listingAsset(distDir, `screenshot-${index}`, shot)),
  );
  return assets;
}

function metadataFor(name, packed, assets) {
  const { atur } = readPackageManifest(extensionDir(name));
  const market = atur.marketplace ?? {};
  const icon = assets.find((asset) => asset.field === "icon");
  const screenshots = assets.filter((asset) => asset.field.startsWith("screenshot-"));
  return {
    name,
    version: packed.version,
    publisher: PUBLISHER,
    firstParty: firstParty.has(name),
    sha256: packed.sha256,
    size: packed.size,
    description: atur.description ?? null,
    permissions: atur.permissions ?? [],
    author:
      market.author || market.github
        ? { name: market.author ?? null, github: market.github ?? null }
        : null,
    homepage: market.homepage ?? null,
    repository: market.repository ?? null,
    categories: market.categories ?? [],
    icon: icon ? { field: icon.field, filename: icon.filename, sha256: icon.sha256 } : null,
    screenshots: screenshots.map((shot) => ({
      field: shot.field,
      filename: shot.filename,
      sha256: shot.sha256,
    })),
  };
}

async function uploadExtension(name) {
  const packed = packExtension(name);
  const assets = collectListingAssets(name);
  const metadata = metadataFor(name, packed, assets);

  if (DRY_RUN) {
    console.log(
      `would upload ${name}@${packed.version} (${packed.size} bytes, sha256=${packed.sha256}) ` +
        `+ icon + ${metadata.screenshots.length} screenshot(s)`,
    );
    return;
  }

  const metadataBytes = Buffer.from(JSON.stringify(metadata), "utf8");
  const zipSignature = sign(packed.zip);
  const metadataSignature = sign(metadataBytes);
  const publicKey = readPublicKey();
  if (
    !verifyBytes(packed.zip, zipSignature, publicKey) ||
    !verifyBytes(metadataBytes, metadataSignature, publicKey)
  ) {
    fail("signature does not verify against signing.pub; EXTENSIONS_SIGNING_KEY does not match the committed public key.");
  }

  const form = new FormData();
  form.set(
    "metadata",
    new Blob([metadataBytes], { type: "application/json" }),
    "metadata.json",
  );
  form.set("metadataSignature", metadataSignature);
  form.set("signature", zipSignature);
  form.set(
    "artifact",
    new Blob([packed.zip], { type: "application/zip" }),
    `${name}-${packed.version}.zip`,
  );
  for (const asset of assets) {
    form.set(asset.field, new Blob([asset.data], { type: asset.contentType }), asset.filename);
  }

  const response = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "X-Extension-Name": name,
      "X-Extension-Version": packed.version,
      "X-Extension-Sha256": packed.sha256,
    },
    body: form,
  });

  if (response.status === 409) {
    console.log(`= ${name}@${packed.version} is already published; skipped`);
    return;
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    fail(`upload failed for ${name}@${packed.version}: HTTP ${response.status} ${body}`);
  }
  console.log(
    `✓ uploaded ${name}@${packed.version} (sha256=${packed.sha256}) + ${assets.length} listing asset(s), metadata signed`,
  );
}

async function main() {
  const names = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
  if (names.length === 0) {
    console.log("No changed extensions to publish.");
    return;
  }

  if (!DRY_RUN) {
    if (!TOKEN) fail("EXTENSIONS_PUBLISH_TOKEN is not set.");
    if (!SECRET_KEY) fail("EXTENSIONS_SIGNING_KEY is not set.");
    if (publicKeyFor(SECRET_KEY) !== readPublicKey()) {
      fail("EXTENSIONS_SIGNING_KEY does not match signing.pub.");
    }
  }

  for (const name of names) {
    if (!fs.existsSync(packageJSONPath(extensionDir(name)))) {
      console.log(`skip ${name} (removed)`);
      continue;
    }
    await uploadExtension(name);
  }
}

main().catch((err) => fail(err.message));
