// Sign-in state, kept in the extension's own storage (`atur.storage`).
//
// `atur.storage` is a per-extension JSON file in the app's data folder: it is not
// shared with other extensions or pages of other origins, but it is not encrypted.
// So only what is needed is kept (one access token, one rotating refresh token, or
// the API key the user typed), nothing is logged, and sign-out revokes and deletes it.

import { createPkce, randomToken } from "./pkce.js";
import {
  ORIGIN,
  REDIRECT_URI,
  OAuthError,
  buildAuthorizeUrl,
  exchangeCode,
  isCallbackUrl,
  parseCallback,
  refreshTokens,
  registerClient,
  revokeToken,
} from "./oauth.js";

const AUTH_KEY = "auth";
const CLIENT_KEY = "oauthClient";
const LOCK_KEY = "authLock";
const LOCK_MS = 15_000;
const SIGN_IN_TIMEOUT_MS = 5 * 60_000;
const API_KEY_PATTERN = /^pk_live_[A-Za-z0-9]{16,}$/;

export class SignedOutError extends Error {
  constructor(message = "Sign in to Atur to continue.") {
    super(message);
    this.name = "SignedOutError";
  }
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createAuth({
  storage,
  fetchFn,
  origin = ORIGIN,
  redirectUri = REDIRECT_URI,
  now = () => Date.now(),
  sleep = defaultSleep,
  random = globalThis.crypto,
}) {
  const owner = randomToken(9, random);
  let inflight = null;

  const load = async () => (await storage.get(AUTH_KEY)) || null;

  async function clientId() {
    const saved = await storage.get(CLIENT_KEY);
    if (saved?.clientId && saved.redirectUri === redirectUri && saved.origin === origin) return saved.clientId;
    const id = await registerClient(fetchFn, { origin, redirectUri });
    await storage.set(CLIENT_KEY, { clientId: id, redirectUri, origin });
    return id;
  }

  async function signOutLocally() {
    await storage.delete(AUTH_KEY);
  }

  /** Replaces an expired OAuth session once, even when several pages notice at the same time. */
  async function refresh(used, force = false) {
    if (inflight) return inflight;
    inflight = (async () => {
      const deadline = now() + 20_000;
      while (now() < deadline) {
        const current = await load();
        if (!current || current.kind !== "oauth") throw new SignedOutError();
        // Another page already rotated the token: use its result, never replay the old one.
        if (current.refreshToken !== used.refreshToken || (!force && current.expiresAt > now())) return current;
        const lock = await storage.get(LOCK_KEY);
        if (lock && lock.owner !== owner && lock.until > now()) {
          await sleep(250);
          continue;
        }
        await storage.set(LOCK_KEY, { owner, until: now() + LOCK_MS });
        await sleep(40);
        if ((await storage.get(LOCK_KEY))?.owner !== owner) continue;
        try {
          if (!current.refreshToken) throw new SignedOutError("Your Atur session ended. Sign in again.");
          const fresh = await refreshTokens(fetchFn, {
            origin,
            clientId: current.clientId,
            refreshToken: current.refreshToken,
            now: now(),
          });
          const next = { ...current, ...fresh, refreshToken: fresh.refreshToken || current.refreshToken };
          await storage.set(AUTH_KEY, next);
          return next;
        } catch (error) {
          if (error instanceof OAuthError && (error.code === "invalid_grant" || error.code === "invalid_client")) {
            const latest = await load();
            if (latest && latest.refreshToken !== current.refreshToken) return latest;
            await signOutLocally();
            throw new SignedOutError("Your Atur session ended. Sign in again.");
          }
          throw error;
        } finally {
          if ((await storage.get(LOCK_KEY))?.owner === owner) await storage.delete(LOCK_KEY);
        }
      }
      throw new Error("Timed out waiting to refresh the Atur session.");
    })().finally(() => {
      inflight = null;
    });
    return inflight;
  }

  /** The current session, refreshed when its access token has expired. */
  async function session() {
    const current = await load();
    if (!current) throw new SignedOutError();
    if (current.kind === "oauth" && current.expiresAt <= now()) return refresh(current);
    return current;
  }

  const headersFor = (current) =>
    current.kind === "apikey" ? { "x-api-key": current.apiKey } : { authorization: `Bearer ${current.accessToken}` };

  return {
    load,
    session,
    headers: async () => headersFor(await session()),
    /** After a 401: trade the refresh token for a new access token. API keys cannot recover. */
    async recover() {
      const current = await load();
      if (!current) throw new SignedOutError();
      if (current.kind !== "oauth") {
        await signOutLocally();
        throw new SignedOutError("That API key was rejected. Check it and try again.");
      }
      return headersFor(await refresh(current, true));
    },

    async signInWithApiKey(value) {
      const apiKey = String(value || "").trim();
      if (!API_KEY_PATTERN.test(apiKey)) throw new Error("That does not look like an Atur API key (pk_live_…).");
      await storage.set(AUTH_KEY, { kind: "apikey", apiKey, signedInAt: now() });
    },

    /**
     * Starts the browser sign-in. `url` is what to open; `complete(callbackUrl)` exchanges the
     * redirected address for tokens. Callers poll the opened tab and pass its address.
     */
    async beginSignIn() {
      const id = await clientId();
      const { verifier, challenge } = createPkce(random);
      const state = randomToken(18, random);
      const startedAt = now();
      return {
        url: buildAuthorizeUrl({ origin, clientId: id, redirectUri, challenge, state }),
        isCallback: (address) => isCallbackUrl(address, redirectUri),
        expired: () => now() - startedAt > SIGN_IN_TIMEOUT_MS,
        async complete(callbackUrl) {
          const code = parseCallback(callbackUrl, state, redirectUri);
          const fresh = await exchangeCode(fetchFn, { origin, clientId: id, redirectUri, code, verifier, now: now() });
          await storage.set(AUTH_KEY, { kind: "oauth", clientId: id, signedInAt: now(), ...fresh });
        },
      };
    },

    async signOut() {
      const current = await load();
      await signOutLocally();
      await storage.delete(LOCK_KEY);
      if (current?.kind === "oauth") {
        // Revoking the refresh token ends the whole grant on the server.
        await revokeToken(fetchFn, { origin, clientId: current.clientId, token: current.refreshToken || current.accessToken });
      }
    },
  };
}
