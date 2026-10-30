import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { sha256 } from "../src/lib/sha256.js";
import { base64url, createPkce } from "../src/lib/pkce.js";

test("sha256 matches node:crypto for empty, short, block-boundary and long inputs", () => {
  for (const length of [0, 1, 3, 55, 56, 63, 64, 65, 119, 120, 1000, 5000]) {
    const bytes = new Uint8Array(randomBytes(length));
    assert.equal(Buffer.from(sha256(bytes)).toString("hex"), createHash("sha256").update(bytes).digest("hex"), `length ${length}`);
  }
  assert.equal(Buffer.from(sha256(new TextEncoder().encode("abc"))).toString("hex"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("PKCE verifier and S256 challenge satisfy the server's format rules", () => {
  const { verifier, challenge } = createPkce();
  assert.match(verifier, /^[A-Za-z0-9\-._~]{43,128}$/);
  assert.match(challenge, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(challenge, createHash("sha256").update(verifier).digest("base64url"));
});

test("base64url has no padding or unsafe characters", () => {
  assert.equal(base64url(new Uint8Array([251, 255, 254])), "-__-");
});

test("verifiers are not reused", () => {
  assert.notEqual(createPkce().verifier, createPkce().verifier);
});
