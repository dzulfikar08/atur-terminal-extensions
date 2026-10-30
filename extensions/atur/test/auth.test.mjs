import { test } from "node:test";
import assert from "node:assert/strict";
import { SignedOutError, createAuth } from "../src/lib/auth.js";
import { REDIRECT_URI } from "../src/lib/oauth.js";
import { fakeFetch, memoryStorage, reply } from "./helpers.mjs";

const instant = async () => {};

function server({ onRefresh } = {}) {
  let refreshes = 0;
  const fetchFn = fakeFetch(async (url, options) => {
    if (url.endsWith("/oauth/register")) return reply(201, { client_id: "client-1" });
    if (url.endsWith("/oauth/token")) {
      const form = Object.fromEntries(new URLSearchParams(options.body));
      if (form.grant_type === "authorization_code") return reply(200, { access_token: "at-1", refresh_token: "rt-1", expires_in: 3600 });
      refreshes += 1;
      if (onRefresh) return onRefresh(form, refreshes);
      await new Promise((resolve) => setTimeout(resolve, 5));
      return reply(200, { access_token: `at-${refreshes + 1}`, refresh_token: `rt-${refreshes + 1}`, expires_in: 3600 });
    }
    return reply(200, "");
  });
  return { fetchFn, refreshCount: () => refreshes };
}

const make = (storage, fetchFn, extra = {}) => createAuth({ storage, fetchFn, sleep: instant, ...extra });

test("browser sign-in registers once, exchanges the code and stores the session", async () => {
  const storage = memoryStorage();
  const { fetchFn } = server();
  const auth = make(storage, fetchFn, { now: () => 1_000 });
  const flow = await auth.beginSignIn();
  const url = new URL(flow.url);
  assert.equal(url.searchParams.get("client_id"), "client-1");
  assert.equal(flow.isCallback(`${REDIRECT_URI}?code=c&state=${url.searchParams.get("state")}`), true);
  await flow.complete(`${REDIRECT_URI}?code=c&state=${url.searchParams.get("state")}`);
  const exchange = fetchFn.calls.find((c) => c.form?.grant_type === "authorization_code");
  assert.equal(exchange.form.code, "c");
  assert.ok(exchange.form.code_verifier);
  assert.deepEqual(await auth.headers(), { authorization: "Bearer at-1" });
  assert.equal((await storage.get("auth")).refreshToken, "rt-1");
  await auth.beginSignIn();
  assert.equal(fetchFn.calls.filter((c) => c.url.endsWith("/oauth/register")).length, 1);
});

test("a callback for a different sign-in attempt is rejected and nothing is stored", async () => {
  const storage = memoryStorage();
  const auth = make(storage, server().fetchFn);
  const flow = await auth.beginSignIn();
  await assert.rejects(flow.complete(`${REDIRECT_URI}?code=c&state=forged`), { code: "state_mismatch" });
  assert.equal(await storage.get("auth"), null);
});

test("sign-in times out after five minutes", async () => {
  let now = 0;
  const auth = make(memoryStorage(), server().fetchFn, { now: () => now });
  const flow = await auth.beginSignIn();
  assert.equal(flow.expired(), false);
  now = 5 * 60_000 + 1;
  assert.equal(flow.expired(), true);
});

test("an expired access token is refreshed and the rotated refresh token stored", async () => {
  let now = 10_000;
  const storage = memoryStorage({ auth: { kind: "oauth", clientId: "client-1", accessToken: "old", refreshToken: "rt-old", expiresAt: 5_000 } });
  const { fetchFn, refreshCount } = server();
  const auth = make(storage, fetchFn, { now: () => now });
  assert.deepEqual(await auth.headers(), { authorization: "Bearer at-2" });
  assert.equal(refreshCount(), 1);
  const saved = await storage.get("auth");
  assert.equal(saved.refreshToken, "rt-2");
  assert.equal(saved.clientId, "client-1");
});

test("two pages refreshing at once spend the refresh token only once", async () => {
  const now = () => 10_000;
  const storage = memoryStorage({ auth: { kind: "oauth", clientId: "client-1", accessToken: "old", refreshToken: "rt-old", expiresAt: 5_000 } });
  const { fetchFn, refreshCount } = server();
  const pageA = make(storage, fetchFn, { now, sleep: (ms) => new Promise((r) => setTimeout(r, Math.min(ms, 3))) });
  const pageB = make(storage, fetchFn, { now, sleep: (ms) => new Promise((r) => setTimeout(r, Math.min(ms, 3))) });
  const [a, b] = await Promise.all([pageA.headers(), pageB.headers()]);
  assert.equal(refreshCount(), 1);
  assert.deepEqual(a, b);
});

test("a rejected refresh token signs the user out locally", async () => {
  const storage = memoryStorage({ auth: { kind: "oauth", clientId: "client-1", accessToken: "old", refreshToken: "rt-old", expiresAt: 1 } });
  const { fetchFn } = server({ onRefresh: () => reply(400, { error: "invalid_grant" }) });
  const auth = make(storage, fetchFn, { now: () => 10_000 });
  await assert.rejects(auth.headers(), SignedOutError);
  assert.equal(await storage.get("auth"), null);
});

test("a rejected refresh that lost a race adopts the other page's tokens instead of signing out", async () => {
  const storage = memoryStorage({ auth: { kind: "oauth", clientId: "client-1", accessToken: "old", refreshToken: "rt-old", expiresAt: 1 } });
  const { fetchFn } = server({
    onRefresh: async () => {
      await storage.set("auth", { kind: "oauth", clientId: "client-1", accessToken: "won", refreshToken: "rt-won", expiresAt: 99_999_999 });
      return reply(400, { error: "invalid_grant" });
    },
  });
  const auth = make(storage, fetchFn, { now: () => 10_000 });
  assert.deepEqual(await auth.headers(), { authorization: "Bearer won" });
});

test("recover() forces a refresh even when the local expiry looks fine", async () => {
  const storage = memoryStorage({ auth: { kind: "oauth", clientId: "client-1", accessToken: "revoked", refreshToken: "rt-old", expiresAt: 99_999_999 } });
  const { fetchFn, refreshCount } = server();
  const auth = make(storage, fetchFn, { now: () => 10_000 });
  assert.deepEqual(await auth.recover(), { authorization: "Bearer at-2" });
  assert.equal(refreshCount(), 1);
});

test("API keys are validated, sent as X-API-Key, and a 401 signs them out", async () => {
  const storage = memoryStorage();
  const auth = make(storage, server().fetchFn);
  await assert.rejects(auth.signInWithApiKey("nope"), /API key/);
  await auth.signInWithApiKey(`  pk_live_${"a".repeat(32)} `);
  assert.deepEqual(await auth.headers(), { "x-api-key": `pk_live_${"a".repeat(32)}` });
  await assert.rejects(auth.recover(), SignedOutError);
  assert.equal(await storage.get("auth"), null);
});

test("no credentials means SignedOutError", async () => {
  await assert.rejects(make(memoryStorage(), server().fetchFn).headers(), SignedOutError);
});

test("sign-out deletes everything and revokes the refresh token", async () => {
  const storage = memoryStorage({ auth: { kind: "oauth", clientId: "client-1", accessToken: "a", refreshToken: "rt-1", expiresAt: 1 }, authLock: { owner: "x", until: 1 } });
  const { fetchFn } = server();
  await make(storage, fetchFn).signOut();
  assert.equal(await storage.get("auth"), null);
  assert.equal(await storage.get("authLock"), null);
  const revoke = fetchFn.calls.find((c) => c.url.endsWith("/oauth/revoke"));
  assert.deepEqual(revoke.form, { token: "rt-1", client_id: "client-1" });
});
