import { run, ExecError } from "../exec.js";
import { detect as detectBinary } from "../cli-detect.js";
import { quoteIdent, quoteLiteral } from "../sql/quote.js";
import { splitForEngine, statementKind } from "../sql/statement-split.js";
import { makeResult, fromObjects, parseJsonStream } from "../parse/result.js";

const BIN = "wrangler";

function tablesWhere(alias = "") {
    const prefix = alias ? `${alias}.` : "";
    return `${prefix}type IN ('table','view') AND ${prefix}name NOT LIKE 'sqlite_%' AND substr(${prefix}name, 1, 4) <> '_cf_'`;
}

function scopeFlags(d1, { persist = true } = {}) {
    const flags = [d1.remote === false ? "--local" : "--remote"];
    const config = (d1.config || "").trim();
    const persistTo = (d1.persistTo || "").trim();
    if (config)
        flags.push("--config", config);
    if (persist && d1.remote === false && persistTo)
        flags.push("--persist-to", persistTo);
    return flags;
}

function executeArgv(ctx, sql) {
    const d1 = ctx.conn.d1;
    return [BIN, "d1", "execute", d1.database.trim(), "--json", ...scopeFlags(d1), "--command", sql];
}

function isStatementResult(value) {
    return value !== null && typeof value === "object" && ("results" in value || "success" in value);
}

function isPayload(value) {
    if (Array.isArray(value))
        return value.every(isStatementResult);
    return value !== null && typeof value === "object" && "error" in value;
}

export function extractPayload(stdout) {
    let lineStart = 0;
    for (const line of stdout.split("\n")) {
        const head = line.trimStart();
        if (head.trimEnd() === "[" || head.startsWith("[{") || head.startsWith("[]") || head.startsWith("{")) {
            const [value] = parseJsonStream(stdout.slice(lineStart + line.length - head.length));
            if (isPayload(value))
                return value;
        }
        lineStart += line.length + 1;
    }
    return null;
}

function describe(error) {
    if (!error)
        return "wrangler reported an error";
    if (typeof error === "string")
        return error;
    const parts = [error.text || error.message || error.name || "Statement failed"];
    for (const note of error.notes || [])
        if (note?.text)
            parts.push(note.text);
    return parts.join("\n");
}

export function payloadError(payload) {
    if (!payload)
        return null;
    if (!Array.isArray(payload))
        return describe(payload.error);
    const failed = payload.find((entry) => entry.success === false);
    return failed ? describe(failed.error || failed.message || "Statement failed") : null;
}

async function execute(ctx, sql, opts = {}) {
    let stdout;
    try {
        stdout = await run(executeArgv(ctx, sql), opts);
    }
    catch (error) {
        const message = payloadError(extractPayload(error.stdout || ""));
        throw message ? new ExecError(message, error) : error;
    }
    const payload = extractPayload(stdout);
    const message = payloadError(payload);
    if (message)
        throw new ExecError(message, { stdout });
    return { payload, stdout };
}

async function entries(ctx, sql, opts) {
    const { payload, stdout } = await execute(ctx, sql, opts);
    if (!Array.isArray(payload))
        throw new ExecError(`Unexpected wrangler output: ${stdout.trim().slice(0, 300) || "(empty)"}`, { stdout });
    return payload;
}

async function rowSets(ctx, sql, opts) {
    return (await entries(ctx, sql, opts)).map((entry) => entry.results || []);
}

function exportArgv(ctx, outPath) {
    const d1 = ctx.conn.d1;
    return [BIN, "d1", "export", d1.database.trim(), ...scopeFlags(d1, { persist: false }), "--output", outPath];
}

function toResult(statement, entry, durationMs) {
    const rows = entry.results || [];
    if (rows.length || (statement && statementKind(statement.sql) === "rows"))
        return { ...fromObjects(rows), durationMs };
    return makeResult({ affectedRows: Number(entry.meta?.changes ?? 0), durationMs });
}

export const d1 = {
    engine: "d1",
    capabilities: { databases: false, schemas: false, routines: false, sequences: false, triggers: true, importCsv: false, explain: true, rowid: true },
    dialect: { explainPrefix: "EXPLAIN QUERY PLAN", cmDialect: "SQLite" },

    detect: () => detectBinary(BIN),

    async test(ctx) {
        const sets = await rowSets(ctx, "SELECT sqlite_version() AS version");
        return { ok: true, serverVersion: sets[0]?.[0]?.version || "" };
    },

    async listDatabases() {
        return [];
    },

    async listSchemas() {
        return [];
    },

    async listTables(ctx) {
        const sets = await rowSets(ctx, `SELECT name, type FROM sqlite_master WHERE ${tablesWhere()} ORDER BY name`);
        return (sets[0] || []).map((row) => ({ name: row.name, kind: row.type === "view" ? "view" : "table" }));
    },

    async tableInfo(ctx, ref) {
        const table = ref.table;
        const [columnsSet, indexListSet, fkSet, masterSet, triggersSet] = await rowSets(
            ctx,
            [
                `PRAGMA table_info(${quoteIdent("sqlite", table)})`,
                `PRAGMA index_list(${quoteIdent("sqlite", table)})`,
                `PRAGMA foreign_key_list(${quoteIdent("sqlite", table)})`,
                `SELECT sql FROM sqlite_master WHERE name = ${quoteLiteral("sqlite", table)}`,
                `SELECT name, sql FROM sqlite_master WHERE type = 'trigger' AND tbl_name = ${quoteLiteral("sqlite", table)}`,
            ].join(";\n"),
        );
        const columns = (columnsSet || []).map((row) => ({
            name: row.name,
            type: row.type || "",
            nullable: row.notnull === 0,
            default: row.dflt_value,
            isPk: row.pk > 0,
            autoIncrement: false,
        }));
        const ddl = masterSet?.[0]?.sql || "";
        const withoutRowid = /WITHOUT\s+ROWID/i.test(ddl);
        const indexList = indexListSet || [];
        const infoSets = indexList.length
            ? await rowSets(ctx, indexList.map((idx) => `PRAGMA index_info(${quoteIdent("sqlite", idx.name)})`).join(";\n"))
            : [];
        const indexes = indexList.map((idx, position) => ({
            name: idx.name,
            unique: idx.unique === 1,
            columns: (infoSets[position] || []).map((c) => c.name).filter(Boolean),
        }));
        const foreignKeys = (fkSet || []).map((row) => ({
            column: row.from,
            refTable: row.table,
            refColumn: row.to,
            onUpdate: row.on_update,
            onDelete: row.on_delete,
        }));
        const triggers = (triggersSet || []).map((row) => ({ name: row.name, definition: row.sql }));
        const primaryKey = columns.filter((c) => c.isPk).map((c) => c.name);
        return { columns, indexes, foreignKeys, triggers, primaryKey, rowid: !withoutRowid && !primaryKey.length ? "rowid" : null };
    },

    async runQuery(ctx, sql, opts = {}) {
        const started = performance.now();
        const payload = await entries(ctx, sql, opts);
        const durationMs = Math.round(performance.now() - started);
        if (!payload.length)
            return [makeResult({ durationMs })];
        const statements = splitForEngine(sql, "d1");
        const aligned = statements.length === payload.length;
        return payload.map((entry, index) => toResult(aligned ? statements[index] : null, entry, durationMs));
    },

    async runScript(ctx, sql, opts = {}) {
        await execute(ctx, sql, opts);
    },

    async ddl(ctx, ref) {
        const sets = await rowSets(ctx, `SELECT sql FROM sqlite_master WHERE name = ${quoteLiteral("sqlite", ref.table)}`);
        return sets[0]?.[0]?.sql || "";
    },

    async dumpDatabase(ctx, outPath, opts = {}) {
        await run(exportArgv(ctx, outPath), opts);
    },

    async allColumns(ctx) {
        const sets = await rowSets(ctx, `SELECT m.name AS t, p.name AS c FROM sqlite_master m JOIN pragma_table_info(m.name) p WHERE ${tablesWhere("m")}`);
        const map = {};
        for (const row of sets[0] || []) {
            (map[row.t] = map[row.t] || []).push(row.c);
        }
        return map;
    },

    async explain(ctx, sql, opts = {}) {
        const started = performance.now();
        const sets = await rowSets(ctx, `EXPLAIN QUERY PLAN ${sql}`, opts);
        return [{ ...fromObjects(sets[0] || []), durationMs: Math.round(performance.now() - started) }];
    },
};
