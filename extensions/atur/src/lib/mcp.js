// A small JSON-RPC client for Atur's MCP endpoint (POST /mcp, stateless: every
// request stands alone, no session handshake). OAuth access tokens are accepted
// only here, which is why the whole extension talks to Atur through MCP tools.

import { MCP_URL } from "./oauth.js";

export class McpError extends Error {
  constructor(message, { status = 0, code = 0 } = {}) {
    super(message);
    this.name = "McpError";
    this.status = status;
    this.code = code;
  }
}

/**
 * `auth` is the object from createAuth(): `headers()` for the current credentials and
 * `recover()` to rebuild them after a 401.
 */
export function createMcp({ fetchFn, auth, endpoint = MCP_URL, timeoutMs = 30_000 }) {
  let nextId = 1;

  async function post(body, headers) {
    return fetchFn(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", ...headers },
      body: JSON.stringify(body),
      timeoutMs,
    });
  }

  async function request(method, params) {
    const body = { jsonrpc: "2.0", id: nextId++, method, params };
    let response = await post(body, await auth.headers());
    if (response.status === 401) response = await post(body, await auth.recover());
    let payload = null;
    try {
      payload = JSON.parse(response.body || "null");
    } catch {
      // handled below
    }
    if (payload?.error) throw new McpError(payload.error.message || "Atur request failed", { status: response.status, code: payload.error.code });
    if (response.status >= 300 || !payload) {
      const detail = payload?.error_description || payload?.error;
      throw new McpError(detail || `Atur answered HTTP ${response.status}`, { status: response.status });
    }
    return payload.result;
  }

  return {
    /** Calls a tool and returns its JSON result (tool results arrive as one JSON text block). */
    async call(name, args = {}) {
      const result = await request("tools/call", { name, arguments: args });
      const text = result?.content?.find((part) => part.type === "text")?.text;
      if (text === undefined) return result ?? null;
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    },
  };
}
