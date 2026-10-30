import { sha256 } from "./sha256.js";

export function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomToken(byteLength = 48, random = globalThis.crypto) {
  const bytes = new Uint8Array(byteLength);
  random.getRandomValues(bytes);
  return base64url(bytes);
}

/** RFC 7636 S256: `verifier` is 64 URL-safe chars, `challenge` is its 43-char digest. */
export function createPkce(random = globalThis.crypto) {
  const verifier = randomToken(48, random);
  const challenge = base64url(sha256(new TextEncoder().encode(verifier)));
  return { verifier, challenge };
}
