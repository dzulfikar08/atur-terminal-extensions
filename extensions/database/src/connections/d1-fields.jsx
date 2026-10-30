import { Field } from "./form-fields.jsx";

export function D1Fields({ conn, patch }) {
    const d1 = conn.d1;
    const patchD1 = (p) => patch({ d1: { ...d1, ...p } });
    return (
        <>
            <Field label="Database name or binding" value={d1.database} placeholder="my-database" onChange={(v) => patchD1({ database: v })} />
            <div className="field">
                <label className="flex items-center gap-[var(--s3)]">
                    <input type="checkbox" checked={d1.remote} onChange={(e) => patchD1({ remote: e.target.checked })} />
                    Remote (production)
                </label>
                <div className="text-[var(--font-footnote)] text-muted-foreground">
                    {d1.remote
                        ? "Queries run against the live database in your Cloudflare account. Authenticate with `wrangler login` or CLOUDFLARE_API_TOKEN."
                        : "Queries run against the local database used by `wrangler dev`."}
                </div>
            </div>
            <Field label="Wrangler config (optional)" value={d1.config} placeholder="/path/to/wrangler.jsonc" onChange={(v) => patchD1({ config: v })} />
            {d1.remote ? null : (
                <Field label="Local persist directory (optional)" value={d1.persistTo} placeholder="/path/to/.wrangler/state" onChange={(v) => patchD1({ persistTo: v })} />
            )}
        </>
    );
}
