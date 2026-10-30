import assert from "node:assert/strict";
import test from "node:test";

let calls = [];
let responses = [];

globalThis.atur = {
    exec: async (argv) => {
        calls.push(argv);
        return responses.length > 1 ? responses.shift() : responses[0];
    },
};

const { d1, extractPayload } = await import("../src/lib/drivers/d1.js");
const { quoteIdent, quoteLiteral } = await import("../src/lib/sql/quote.js");
const { buildSelect } = await import("../src/lib/sql/select-builder.js");

const remote = { conn: { engine: "d1", d1: { database: "my-db", remote: true, config: "", persistTo: "" } } };
const local = { conn: { engine: "d1", d1: { database: "DB", remote: false, config: "/work/wrangler.jsonc", persistTo: "/work/.state" } } };

function reply(payload, prefix = "") {
    return { exitCode: 0, stdout: prefix + JSON.stringify(payload, null, 2) + "\n", stderr: "" };
}

function entry(results, changes = 0) {
    return { results, success: true, meta: { changes, rows_read: results.length, duration: 0.3 } };
}

function setup(...next) {
    calls = [];
    responses = next;
}

test("remote argv has no shell, JSON output and --remote", async () => {
    setup(reply([entry([{ version: "3.45.1" }])]));
    const result = await d1.test(remote);
    assert.deepEqual(calls[0], ["wrangler", "d1", "execute", "my-db", "--json", "--remote", "--command", "SELECT sqlite_version() AS version"]);
    assert.deepEqual(result, { ok: true, serverVersion: "3.45.1" });
});

test("local argv carries --local, config and persist dir", async () => {
    setup(reply([entry([{ version: "3.45.1" }])]));
    await d1.test(local);
    assert.deepEqual(calls[0], [
        "wrangler", "d1", "execute", "DB", "--json", "--local",
        "--config", "/work/wrangler.jsonc", "--persist-to", "/work/.state",
        "--command", "SELECT sqlite_version() AS version",
    ]);
});

test("remote mode with a config path omits --persist-to", async () => {
    setup(reply([entry([{ version: "3" }])]));
    await d1.test({ conn: { d1: { database: "x", remote: true, config: "wrangler.toml", persistTo: "/ignored" } } });
    assert.deepEqual(calls[0].slice(0, 8), ["wrangler", "d1", "execute", "x", "--json", "--remote", "--config", "wrangler.toml"]);
    assert.ok(!calls[0].includes("--persist-to"));
});

test("wrangler banner noise before the JSON is skipped", async () => {
    const banner = " ⛅️ wrangler 4.20.0\n-------------------\n[wrangler:info] Executing on remote database my-db:\n🌀 Executing on remote database my-db (abc):\n";
    setup(reply([entry([{ name: "accounts", type: "table" }, { name: "balances", type: "view" }])], banner));
    assert.deepEqual(await d1.listTables(remote), [
        { name: "accounts", kind: "table" },
        { name: "balances", kind: "view" },
    ]);
});

test("payload is found in compact output after bracketed log lines", () => {
    const stdout = '[wrangler:info] starting\n[{"results":[{"a":1}],"success":true,"meta":{"changes":0}}]\n';
    assert.deepEqual(extractPayload(stdout), [{ results: [{ a: 1 }], success: true, meta: { changes: 0 } }]);
    assert.equal(extractPayload("no json here\n"), null);
});

test("listTables hides sqlite and Cloudflare internal tables in the query", async () => {
    setup(reply([entry([])]));
    await d1.listTables(remote);
    const sql = calls[0].at(-1);
    assert.match(sql, /sqlite_master/);
    assert.match(sql, /'sqlite_%'/);
    assert.match(sql, /'_cf_'/);
});

test("runQuery maps rows to a result set", async () => {
    setup(reply([entry([{ id: 1, name: "a" }, { id: 2, name: null }])]));
    const [result] = await d1.runQuery(remote, "SELECT id, name FROM t");
    assert.deepEqual(result.columns, [{ name: "id" }, { name: "name" }]);
    assert.deepEqual(result.rows, [["1", "a"], ["2", null]]);
});

test("runQuery reports affected rows from meta.changes", async () => {
    setup(reply([entry([], 3)]));
    const [result] = await d1.runQuery(remote, "UPDATE t SET name = 'x'");
    assert.equal(result.affectedRows, 3);
    assert.deepEqual(result.rows, []);
});

test("runQuery returns one result per statement", async () => {
    setup(reply([entry([], 1), entry([{ n: 5 }])]));
    const results = await d1.runQuery(remote, "INSERT INTO t VALUES (1); SELECT 5 AS n;");
    assert.equal(results.length, 2);
    assert.equal(results[0].affectedRows, 1);
    assert.deepEqual(results[1].rows, [["5"]]);
});

test("a SELECT with no rows is not reported as a command", async () => {
    setup(reply([entry([])]));
    const [result] = await d1.runQuery(remote, "SELECT * FROM t WHERE 0");
    assert.equal(result.affectedRows, null);
});

test("success:false in the payload is surfaced as an error", async () => {
    setup(reply([{ results: [], success: false, error: "no such table: nope" }]));
    await assert.rejects(d1.runQuery(remote, "SELECT * FROM nope"), /no such table: nope/);
});

test("non-zero exit surfaces the wrangler JSON error text", async () => {
    setup({
        exitCode: 1,
        stdout: JSON.stringify({ error: { text: "D1_ERROR: no such table: nope", notes: [{ text: "SQLITE_ERROR" }] } }),
        stderr: "",
    });
    await assert.rejects(d1.runQuery(remote, "SELECT * FROM nope"), /D1_ERROR: no such table: nope\nSQLITE_ERROR/);
});

test("non-zero exit without JSON falls back to stderr", async () => {
    setup({ exitCode: 1, stdout: "", stderr: "You are not authenticated" });
    await assert.rejects(d1.test(remote), /You are not authenticated/);
});

test("tableInfo batches introspection into one wrangler call plus index details", async () => {
    setup(
        reply([
            entry([{ cid: 0, name: "id", type: "INTEGER", notnull: 1, dflt_value: null, pk: 1 }, { cid: 1, name: "email", type: "TEXT", notnull: 0, dflt_value: null, pk: 0 }]),
            entry([{ seq: 0, name: "idx_email", unique: 1 }]),
            entry([{ id: 0, seq: 0, table: "orgs", from: "org_id", to: "id", on_update: "NO ACTION", on_delete: "CASCADE" }]),
            entry([{ sql: "CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT)" }]),
            entry([]),
        ]),
        reply([entry([{ seqno: 0, cid: 1, name: "email" }])]),
    );
    const info = await d1.tableInfo(remote, { table: "users" });
    assert.equal(calls.length, 2);
    assert.match(calls[0].at(-1), /^PRAGMA table_info\("users"\);\nPRAGMA index_list\("users"\);/);
    assert.equal(calls[1].at(-1), 'PRAGMA index_info("idx_email")');
    assert.deepEqual(info.primaryKey, ["id"]);
    assert.deepEqual(info.indexes, [{ name: "idx_email", unique: true, columns: ["email"] }]);
    assert.equal(info.foreignKeys[0].refTable, "orgs");
    assert.equal(info.rowid, null);
});

test("runScript sends the statements without BEGIN/COMMIT", async () => {
    setup(reply([entry([], 1), entry([], 1)]));
    await d1.runScript(remote, "UPDATE a SET x = 1;\nDELETE FROM b;");
    assert.equal(calls[0].at(-1), "UPDATE a SET x = 1;\nDELETE FROM b;");
    assert.ok(!/BEGIN|COMMIT/i.test(calls[0].at(-1)));
});

test("runScript fails when any statement reports success:false", async () => {
    setup(reply([entry([], 1), { results: [], success: false, error: "constraint failed" }]));
    await assert.rejects(d1.runScript(remote, "A; B;"), /constraint failed/);
});

test("explain wraps the statement in EXPLAIN QUERY PLAN", async () => {
    setup(reply([entry([{ id: 2, parent: 0, notused: 0, detail: "SCAN t" }])]));
    const [result] = await d1.explain(remote, "SELECT * FROM t");
    assert.equal(calls[0].at(-1), "EXPLAIN QUERY PLAN SELECT * FROM t");
    assert.equal(result.rows[0][3], "SCAN t");
});

test("dumpDatabase uses wrangler d1 export", async () => {
    setup({ exitCode: 0, stdout: "", stderr: "" });
    await d1.dumpDatabase(local, "/tmp/out.sql");
    assert.deepEqual(calls[0], ["wrangler", "d1", "export", "DB", "--local", "--config", "/work/wrangler.jsonc", "--output", "/tmp/out.sql"]);
    await d1.dumpDatabase(remote, "/tmp/out.sql");
    assert.deepEqual(calls[1], ["wrangler", "d1", "export", "my-db", "--remote", "--output", "/tmp/out.sql"]);
});

test("capabilities hide CSV import and the dialect is sqlite-like", () => {
    assert.equal(d1.capabilities.importCsv, false);
    assert.equal(d1.capabilities.rowid, true);
    assert.equal(d1.dialect.explainPrefix, "EXPLAIN QUERY PLAN");
});

test("d1 uses sqlite quoting and rowid selects", () => {
    assert.equal(quoteIdent("d1", 'we"ird'), '"we""ird"');
    assert.equal(quoteLiteral("d1", true), "1");
    assert.equal(quoteLiteral("d1", "it's"), "'it''s'");
    assert.equal(buildSelect("d1", { table: "t" }, { rowid: true, limit: 10, offset: 0 }), 'SELECT rowid AS __rowid, * FROM "t" LIMIT 10 OFFSET 0');
});
