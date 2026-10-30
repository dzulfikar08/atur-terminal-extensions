import { test } from "node:test";
import assert from "node:assert/strict";
import { ORIGIN, REDIRECT_URI, OAuthError, buildAuthorizeUrl, exchangeCode, isCallbackUrl, parseCallback, refreshTokens, registerClient, revokeToken } from "../src/lib/oauth.js";
import { fakeFetch, reply } from "./helpers.mjs";

test("authorize URL carries PKCE S256, state, scope and the MCP resource", () => {
  const url = new URL(buildAuthorizeUrl({ clientId: "c1", challenge: "x".repeat(43), state: "st" }));
  assert.equal(`${url.origin}${url.pathname}`, `${ORIGIN}/oauth/authorize`);
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    response_type: "code",
    client_id: "c1",
    redirect_uri: REDIRECT_URI,
    code_challenge: "x".repeat(43),
    code_challenge_method: "S256",
    state: "st",
    scope: "mcp",
    resource: `${ORIGIN}/mcp`,
  });
});

test("the callback is recognised by address and its code is extracted", () => {
  assert.equal(isCallbackUrl(`${REDIRECT_URI}?code=abc&state=s`), true);
  assert.equal(isCallbackUrl("https://app.diatur.com/oauth/authorize?x=1"), false);
  assert.equal(parseCallback(`${REDIRECT_URI}?code=abc&state=s`, "s"), "abc");
});

test("a callback with the wrong state, an error, no code or another address is refused", () => {
  assert.throws(() => parseCallback(`${REDIRECT_URI}?code=abc&state=other`, "s"), { code: "state_mismatch" });
  assert.throws(() => parseCallback(`${REDIRECT_URI}?error=access_denied&state=s`, "s"), { code: "access_denied" });
  assert.throws(() => parseCallback(`${REDIRECT_URI}?state=s`, "s"), { code: "invalid_callback" });
  assert.throws(() => parseCallback("https://evil.example/oauth/atur-terminal?code=abc&state=s", "s"), { code: "invalid_callback" });
  assert.throws(() => parseCallback("not a url", "s"), OAuthError);
});

test("registration is a public client with the fixed redirect", async () => {
  const fetchFn = fakeFetch(() => reply(201, { client_id: "client-9" }));
  assert.equal(await registerClient(fetchFn), "client-9");
  const sent = JSON.parse(fetchFn.calls[0].body);
  assert.equal(fetchFn.calls[0].url, `${ORIGIN}/oauth/register`);
  assert.deepEqual(sent.redirect_uris, [REDIRECT_URI]);
  assert.equal(sent.token_endpoint_auth_method, "none");
});

test("registration failures surface the server's reason", async () => {
  await assert.rejects(registerClient(fakeFetch(() => reply(400, { error: "invalid_redirect_uri", error_description: "no" }))), { code: "invalid_redirect_uri" });
});

test("code exchange sends the verifier and resource and expires the token early", async () => {
  const fetchFn = fakeFetch(() => reply(200, { access_token: "atur_at_1", refresh_token: "atur_rt_1", expires_in: 3600 }));
  const tokens = await exchangeCode(fetchFn, { clientId: "c1", code: "abc", verifier: "v".repeat(43), now: 1_000 });
  assert.deepEqual(fetchFn.calls[0].form, {
    grant_type: "authorization_code",
    client_id: "c1",
    code: "abc",
    code_verifier: "v".repeat(43),
    redirect_uri: REDIRECT_URI,
    resource: `${ORIGIN}/mcp`,
  });
  assert.deepEqual(tokens, { accessToken: "atur_at_1", refreshToken: "atur_rt_1", expiresAt: 1_000 + 3540 * 1000 });
});

test("a rejected exchange throws the OAuth error code", async () => {
  await assert.rejects(exchangeCode(fakeFetch(() => reply(400, { error: "invalid_grant", error_description: "used" })), { clientId: "c", code: "x", verifier: "y" }), { code: "invalid_grant" });
});

test("refresh sends the refresh token and returns the rotated pair", async () => {
  const fetchFn = fakeFetch(() => reply(200, { access_token: "a2", refresh_token: "r2", expires_in: 60 }));
  const tokens = await refreshTokens(fetchFn, { clientId: "c1", refreshToken: "r1", now: 0 });
  assert.equal(fetchFn.calls[0].form.grant_type, "refresh_token");
  assert.equal(fetchFn.calls[0].form.refresh_token, "r1");
  assert.equal(tokens.refreshToken, "r2");
  assert.equal(tokens.expiresAt, 0);
});

test("revoke never throws", async () => {
  await revokeToken(async () => {
    throw new Error("offline");
  }, { clientId: "c", token: "t" });
  const fetchFn = fakeFetch(() => reply(200, ""));
  await revokeToken(fetchFn, { clientId: "c", token: "t" });
  assert.equal(fetchFn.calls[0].url, `${ORIGIN}/oauth/revoke`);
  assert.deepEqual(fetchFn.calls[0].form, { token: "t", client_id: "c" });
});
