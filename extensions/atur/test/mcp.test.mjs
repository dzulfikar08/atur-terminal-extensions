import { test } from "node:test";
import assert from "node:assert/strict";
import { McpError, createMcp } from "../src/lib/mcp.js";
import { MCP_URL } from "../src/lib/oauth.js";
import { fakeFetch, reply, toolResult } from "./helpers.mjs";

const auth = (headers = { authorization: "Bearer t1" }) => ({ headers: async () => headers, recover: async () => ({ authorization: "Bearer t2" }) });

test("a tool call is a JSON-RPC tools/call POST and returns the parsed JSON text", async () => {
  const fetchFn = fakeFetch(() => reply(200, toolResult({ results: [1, 2] })));
  const result = await createMcp({ fetchFn, auth: auth() }).call("my_issues", { limit: 5 });
  assert.deepEqual(result, { results: [1, 2] });
  const call = fetchFn.calls[0];
  assert.equal(call.url, MCP_URL);
  assert.equal(call.method, "POST");
  assert.equal(call.headers.authorization, "Bearer t1");
  assert.deepEqual(JSON.parse(call.body), { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "my_issues", arguments: { limit: 5 } } });
});

test("a 401 recovers the credentials once and retries with them", async () => {
  const fetchFn = fakeFetch((url, options) => (options.headers.authorization === "Bearer t2" ? reply(200, toolResult({ ok: true })) : reply(401, { error: "invalid_token" })));
  assert.deepEqual(await createMcp({ fetchFn, auth: auth() }).call("whoami"), { ok: true });
  assert.equal(fetchFn.calls.length, 2);
});

test("a second 401 is an error, not a loop", async () => {
  const fetchFn = fakeFetch(() => reply(401, { error: "invalid_token", error_description: "Invalid or expired token" }));
  await assert.rejects(createMcp({ fetchFn, auth: auth() }).call("whoami"), { name: "McpError", status: 401 });
  assert.equal(fetchFn.calls.length, 2);
});

test("JSON-RPC errors carry the server's message", async () => {
  const fetchFn = fakeFetch(() => reply(400, { jsonrpc: "2.0", id: 1, error: { code: -32000, message: "Unknown tool: my_issues" } }));
  await assert.rejects(createMcp({ fetchFn, auth: auth() }).call("my_issues"), (error) => error instanceof McpError && error.message === "Unknown tool: my_issues" && error.code === -32000);
});

test("non-JSON replies and plain-text tool results are handled", async () => {
  await assert.rejects(createMcp({ fetchFn: fakeFetch(() => reply(502, "bad gateway")), auth: auth() }).call("x"), /HTTP 502/);
  const text = fakeFetch(() => reply(200, { jsonrpc: "2.0", id: 1, result: { content: [{ type: "text", text: "plain" }] } }));
  assert.equal(await createMcp({ fetchFn: text, auth: auth() }).call("x"), "plain");
});

test("API key credentials are passed through untouched", async () => {
  const fetchFn = fakeFetch(() => reply(200, toolResult({})));
  await createMcp({ fetchFn, auth: auth({ "x-api-key": "pk_live_x" }) }).call("x");
  assert.equal(fetchFn.calls[0].headers["x-api-key"], "pk_live_x");
});
