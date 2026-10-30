// OAuth 2.1 authorization-code + PKCE against Atur's MCP authorization server
// (docs/mcp-oauth.md in the Atur repo). Network access goes through an injected
// `fetchFn(url, { method, headers, body })` shaped like `atur.http.fetch`.

export const ORIGIN = "https://app.diatur.com";
export const MCP_URL = `${ORIGIN}/mcp`;
export const SCOPE = "mcp";
export const CLIENT_NAME = "Atur Terminal";
// A registered https redirect: the in-app browser lands here after consent and the
// extension reads the code from the tab's address. The page itself is never used.
export const REDIRECT_URI = "https://extensions.diatur.com/oauth/atur-terminal";

export class OAuthError extends Error {
  constructor(code, description) {
    super(description ? `${code}: ${description}` : code);
    this.name = "OAuthError";
    this.code = code;
  }
}

function json(response) {
  try {
    return JSON.parse(response.body || "{}");
  } catch {
    return {};
  }
}

function form(params) {
  return new URLSearchParams(params).toString();
}

function failure(response, fallback) {
  const body = json(response);
  return new OAuthError(body.error || fallback, body.error_description || `HTTP ${response.status}`);
}

/** Dynamic client registration (RFC 7591) for a public client. Returns the `client_id`. */
export async function registerClient(fetchFn, { origin = ORIGIN, redirectUri = REDIRECT_URI } = {}) {
  const response = await fetchFn(`${origin}/oauth/register`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      client_name: CLIENT_NAME,
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: SCOPE,
    }),
  });
  const body = json(response);
  if (response.status >= 300 || !body.client_id) throw failure(response, "registration_failed");
  return body.client_id;
}

export function buildAuthorizeUrl({ origin = ORIGIN, clientId, redirectUri = REDIRECT_URI, challenge, state }) {
  const query = form({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
    scope: SCOPE,
    resource: `${origin}/mcp`,
  });
  return `${origin}/oauth/authorize?${query}`;
}

/** True once a browser address is the redirect target (code or error present). */
export function isCallbackUrl(url, redirectUri = REDIRECT_URI) {
  return typeof url === "string" && url.startsWith(redirectUri);
}

/** Pulls the authorization code out of the redirected address, checking `state`. */
export function parseCallback(url, expectedState, redirectUri = REDIRECT_URI) {
  let parsed;
  try {
    parsed = new URL(String(url).trim());
  } catch {
    throw new OAuthError("invalid_callback", "That is not a web address.");
  }
  if (`${parsed.origin}${parsed.pathname}` !== redirectUri) {
    throw new OAuthError("invalid_callback", "That address is not the sign-in redirect.");
  }
  const error = parsed.searchParams.get("error");
  if (error) throw new OAuthError(error, parsed.searchParams.get("error_description") || "Access was denied.");
  if (parsed.searchParams.get("state") !== expectedState) {
    throw new OAuthError("state_mismatch", "The sign-in response does not match this request.");
  }
  const code = parsed.searchParams.get("code");
  if (!code) throw new OAuthError("invalid_callback", "The sign-in response has no code.");
  return code;
}

function tokens(response, now) {
  const body = json(response);
  if (response.status >= 300 || !body.access_token) throw failure(response, "token_failed");
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token || null,
    // Treat the token as expired a little early so a request never races the deadline.
    expiresAt: now + Math.max(0, (Number(body.expires_in) || 3600) - 60) * 1000,
  };
}

export async function exchangeCode(fetchFn, { origin = ORIGIN, clientId, redirectUri = REDIRECT_URI, code, verifier, now = Date.now() }) {
  const response = await fetchFn(`${origin}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: form({
      grant_type: "authorization_code",
      client_id: clientId,
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
      resource: `${origin}/mcp`,
    }),
  });
  return tokens(response, now);
}

/** Refresh tokens rotate: the returned `refreshToken` replaces the one sent. */
export async function refreshTokens(fetchFn, { origin = ORIGIN, clientId, refreshToken, now = Date.now() }) {
  const response = await fetchFn(`${origin}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: form({
      grant_type: "refresh_token",
      client_id: clientId,
      refresh_token: refreshToken,
      resource: `${origin}/mcp`,
    }),
  });
  return tokens(response, now);
}

/** RFC 7009. Best effort: a failed revoke must not keep the user signed in locally. */
export async function revokeToken(fetchFn, { origin = ORIGIN, clientId, token }) {
  try {
    await fetchFn(`${origin}/oauth/revoke`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form({ token, client_id: clientId }),
    });
  } catch {
    // ignored on purpose
  }
}
