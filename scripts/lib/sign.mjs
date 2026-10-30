import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "./paths.mjs";

// Detached Ed25519 signatures. The private key travels as base64 PKCS#8 DER
// (the EXTENSIONS_SIGNING_KEY secret); the public key as the 32 raw key bytes in
// base64 (`signing.pub`, baked into the Atur Terminal app). A signature is the
// 64 raw bytes in base64, computed over the exact bytes that are uploaded.

const SPKI_ED25519_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export const publicKeyPath = path.join(repoRoot, "signing.pub");

export function readPublicKey(file = publicKeyPath) {
  return fs.readFileSync(file, "utf8").trim();
}

function privateKeyObject(secretBase64) {
  return crypto.createPrivateKey({
    key: Buffer.from(secretBase64.trim(), "base64"),
    format: "der",
    type: "pkcs8",
  });
}

function publicKeyObject(publicBase64) {
  const raw = Buffer.from(publicBase64.trim(), "base64");
  if (raw.length !== 32) throw new Error("public key must be 32 raw bytes (base64)");
  return crypto.createPublicKey({
    key: Buffer.concat([SPKI_ED25519_PREFIX, raw]),
    format: "der",
    type: "spki",
  });
}

export function signBytes(bytes, secretBase64) {
  return crypto.sign(null, bytes, privateKeyObject(secretBase64)).toString("base64");
}

export function verifyBytes(bytes, signatureBase64, publicBase64) {
  try {
    return crypto.verify(
      null,
      bytes,
      publicKeyObject(publicBase64),
      Buffer.from(signatureBase64.trim(), "base64"),
    );
  } catch {
    return false;
  }
}

export function publicKeyFor(secretBase64) {
  const spki = crypto
    .createPublicKey(privateKeyObject(secretBase64))
    .export({ type: "spki", format: "der" });
  return spki.subarray(spki.length - 32).toString("base64");
}

export function generateKeyPair() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  const spki = publicKey.export({ type: "spki", format: "der" });
  return {
    secret: privateKey.export({ type: "pkcs8", format: "der" }).toString("base64"),
    public: spki.subarray(spki.length - 32).toString("base64"),
  };
}
