import assert from "node:assert/strict";
import test from "node:test";
import { generateKeyPair, publicKeyFor, signBytes, verifyBytes } from "./sign.mjs";

test("signatures verify only for the signed bytes and the matching key", () => {
  const pair = generateKeyPair();
  const other = generateKeyPair();
  const bytes = Buffer.from("extension zip bytes");
  const signature = signBytes(bytes, pair.secret);

  assert.equal(Buffer.from(signature, "base64").length, 64);
  assert.equal(verifyBytes(bytes, signature, pair.public), true);
  assert.equal(verifyBytes(Buffer.from("tampered"), signature, pair.public), false);
  assert.equal(verifyBytes(bytes, signature, other.public), false);
  assert.equal(verifyBytes(bytes, "not base64!", pair.public), false);
});

test("the public key derives from the secret", () => {
  const pair = generateKeyPair();
  assert.equal(publicKeyFor(pair.secret), pair.public);
  assert.equal(Buffer.from(pair.public, "base64").length, 32);
});
