// Host data for the database extension: saved connections, a fake `psql`/`pg_dump`/`which`
// behind atur.exec, and a small "acme-web" PostgreSQL database whose query results are
// computed from generated orders. The case's `data.scene` picks what the page does after
// it loads: "query", "data" or "structure" (workbench tab); the panel needs no scene.
(() => {
  const h = window.__harness;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  let seed = 20261030;
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const between = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const stamp = (ms) => new Date(ms).toISOString().replace("T", " ").slice(0, 19);

  const now = Date.UTC(2026, 9, 30, 9, 30);
  const HOUR = 3600 * 1000;

  const connections = [
    { id: "c-acme-dev", name: "acme-web dev", engine: "postgres", group: "acme-web", color: "#61afef", keychain: true,
      net: { host: "127.0.0.1", port: 5432, user: "acme", database: "acme_web_dev", sslMode: "" }, createdAt: now - 90 * 24 * HOUR, lastUsedAt: now - 2 * HOUR },
    { id: "c-acme-staging", name: "acme-web staging", engine: "postgres", group: "acme-web", color: "#e5a56b", keychain: true,
      net: { host: "staging-db.acme.dev", port: 5432, user: "acme_app", database: "acme_web", sslMode: "require" },
      ssh: { enabled: true, host: "bastion.acme.dev", port: 22, user: "deploy" }, createdAt: now - 80 * 24 * HOUR, lastUsedAt: now - 30 * HOUR },
    { id: "c-acme-prod", name: "acme-web production (read-only)", engine: "postgres", group: "acme-web", color: "#e06c75", keychain: true,
      net: { host: "db.acme.dev", port: 5432, user: "readonly", database: "acme_web", sslMode: "verify-full" },
      ssh: { enabled: true, host: "bastion.acme.dev", port: 22, user: "deploy" }, createdAt: now - 80 * 24 * HOUR, lastUsedAt: now - 75 * HOUR },
    { id: "c-warehouse", name: "Analytics warehouse", engine: "mariadb", group: "Analytics", color: "#c678dd", keychain: true,
      net: { host: "warehouse.acme.dev", port: 3306, user: "analyst", database: "analytics", sslMode: "" }, createdAt: now - 60 * 24 * HOUR, lastUsedAt: now - 120 * HOUR },
    { id: "c-marketing", name: "Marketing reports", engine: "mysql", group: "Analytics", color: "#56b6c2", keychain: true,
      net: { host: "10.0.4.12", port: 3306, user: "reports", database: "marketing", sslMode: "" }, createdAt: now - 50 * 24 * HOUR, lastUsedAt: now - 200 * HOUR },
    { id: "c-cache", name: "Local cache", engine: "sqlite", group: "", color: "#abb2bf", keychain: false,
      sqlite: { path: "/home/dev/acme-web/storage/cache.sqlite3" }, createdAt: now - 40 * 24 * HOUR, lastUsedAt: now - 400 * HOUR },
  ];
  h.memory.set("connections:v1", connections);

  const customers = [
    [1, "Maya Chen", "maya.chen@brightlabs.example", "enterprise"],
    [2, "Daniel Okafor", "daniel@okafor-design.example", "pro"],
    [3, "Sofia Marques", "sofia.marques@lumen-studio.example", "team"],
    [4, "Liam Fischer", "liam@fischerworks.example", "pro"],
    [5, "Aisha Rahman", "aisha.rahman@cedarandco.example", "enterprise"],
    [6, "Noah Bennett", "noah.bennett@bennett.example", "free"],
    [7, "Hana Sato", "hana@kitefield.example", "team"],
    [8, "Mateo Ruiz", "mateo.ruiz@ruizlogistics.example", "pro"],
    [9, "Elena Petrova", "elena.petrova@northpeak.example", "enterprise"],
    [10, "Oliver Grant", "oliver@grantandsons.example", "team"],
    [11, "Priya Nair", "priya.nair@harbor-labs.example", "pro"],
    [12, "Lucas Meyer", "lucas@meyer-analytics.example", "team"],
    [13, "Chloe Dubois", "chloe.dubois@atelier-dubois.example", "pro"],
    [14, "Samuel Adeyemi", "samuel@tidewater.example", "free"],
    [15, "Ingrid Larsen", "ingrid.larsen@larsen-co.example", "team"],
    [16, "Ravi Patel", "ravi@patelmedia.example", "enterprise"],
  ].map(([id, name, email, plan]) => ({ id, name, email, plan }));
  const weight = { enterprise: 5, team: 3, pro: 2, free: 1 };
  const bag = customers.flatMap((c) => Array(weight[c.plan]).fill(c));
  const ceiling = { enterprise: 48000, team: 26000, pro: 14000, free: 4900 };

  const orders = [];
  let placed = Date.UTC(2026, 2, 2, 8, 0);
  while (placed < now - 2 * HOUR) {
    const customer = pick(bag);
    const age = (now - placed) / (24 * HOUR);
    const roll = rand();
    let status;
    if (age < 3) status = roll < 0.4 ? "pending" : roll < 0.85 ? "paid" : "shipped";
    else if (age < 7) status = roll < 0.7 ? "shipped" : roll < 0.9 ? "paid" : roll < 0.96 ? "cancelled" : "refunded";
    else status = roll < 0.86 ? "shipped" : roll < 0.94 ? "cancelled" : "refunded";
    const subtotal = between(1900, ceiling[customer.plan]);
    const tax = Math.round(subtotal * 0.08);
    const shipped = status === "shipped" || status === "refunded" ? stamp(placed + between(20, 70) * HOUR) : null;
    orders.push({
      id: orders.length + 1,
      customer_id: customer.id,
      status,
      currency: "USD",
      subtotal_cents: subtotal,
      tax_cents: tax,
      total_cents: subtotal + tax,
      coupon_code: rand() < 0.14 ? pick(["WELCOME10", "SPRING25", "TEAMUP15"]) : null,
      placed_at: stamp(placed),
      shipped_at: shipped,
    });
    placed += Math.round((1 + rand() * 4.4) * HOUR);
  }

  const money = (cents) => (cents / 100).toFixed(2);
  const paidOrders = orders.filter((o) => o.status === "paid" || o.status === "shipped");

  const topCustomers = () => {
    const rows = customers.map((c) => {
      const own = paidOrders.filter((o) => o.customer_id === c.id);
      const total = own.reduce((sum, o) => sum + o.total_cents, 0);
      return { c, count: own.length, total, last: own.map((o) => o.placed_at).sort().pop() };
    });
    rows.sort((a, b) => b.total - a.total);
    return [["id", "name", "email", "plan", "orders", "lifetime_value", "last_order_at"]].concat(
      rows.slice(0, 10).map((r) => [r.c.id, r.c.name, r.c.email, r.c.plan, r.count, money(r.total), r.last]),
    );
  };

  const monthlyRevenue = () => {
    const byMonth = new Map();
    for (const o of paidOrders) {
      const key = o.placed_at.slice(0, 7);
      const entry = byMonth.get(key) || { count: 0, total: 0 };
      entry.count += 1;
      entry.total += o.total_cents;
      byMonth.set(key, entry);
    }
    return [["month", "orders", "revenue", "avg_order_value"]].concat(
      [...byMonth.keys()].sort().reverse().map((key) => {
        const entry = byMonth.get(key);
        return [key, entry.count, money(entry.total), money(entry.total / entry.count)];
      }),
    );
  };

  const col = (name, type, extra = {}) => ({ name, type, nullable: false, default: null, pk: false, ...extra });
  const TABLES = {
    orders: {
      rows: orders,
      columns: [
        col("id", "bigint", { pk: true, default: "nextval('orders_id_seq'::regclass)" }),
        col("customer_id", "bigint"),
        col("status", "text", { default: "'pending'::text" }),
        col("currency", "character", { default: "'USD'::bpchar" }),
        col("subtotal_cents", "integer"),
        col("tax_cents", "integer", { default: "0" }),
        col("total_cents", "integer"),
        col("coupon_code", "text", { nullable: true }),
        col("placed_at", "timestamp without time zone", { default: "now()" }),
        col("shipped_at", "timestamp without time zone", { nullable: true }),
      ],
      indexes: [
        ["orders_pkey", "CREATE UNIQUE INDEX orders_pkey ON public.orders USING btree (id)"],
        ["idx_orders_customer_id", "CREATE INDEX idx_orders_customer_id ON public.orders USING btree (customer_id)"],
        ["idx_orders_status_placed_at", "CREATE INDEX idx_orders_status_placed_at ON public.orders USING btree (status, placed_at)"],
      ],
      fks: [["orders_customer_id_fkey", "FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT"]],
      triggers: [["orders_set_updated_at", "CREATE TRIGGER orders_set_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION set_updated_at()"]],
      ddl: [
        "CREATE TABLE public.orders (",
        "    id bigint NOT NULL,",
        "    customer_id bigint NOT NULL,",
        "    status text DEFAULT 'pending'::text NOT NULL,",
        "    currency character(3) DEFAULT 'USD'::bpchar NOT NULL,",
        "    subtotal_cents integer NOT NULL,",
        "    tax_cents integer DEFAULT 0 NOT NULL,",
        "    total_cents integer NOT NULL,",
        "    coupon_code text,",
        "    placed_at timestamp without time zone DEFAULT now() NOT NULL,",
        "    shipped_at timestamp without time zone",
        ");",
        "ALTER TABLE ONLY public.orders",
        "    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);",
        "CREATE INDEX idx_orders_customer_id ON public.orders USING btree (customer_id);",
        "CREATE INDEX idx_orders_status_placed_at ON public.orders USING btree (status, placed_at);",
        "ALTER TABLE ONLY public.orders",
        "    ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;",
      ].join("\n"),
    },
    customers: {
      rows: customers,
      columns: [
        col("id", "bigint", { pk: true, default: "nextval('customers_id_seq'::regclass)" }),
        col("name", "text"),
        col("email", "text"),
        col("plan", "text", { default: "'free'::text" }),
        col("created_at", "timestamp without time zone", { default: "now()" }),
      ],
      indexes: [["customers_pkey", "CREATE UNIQUE INDEX customers_pkey ON public.customers USING btree (id)"]],
      fks: [],
      triggers: [],
      ddl: "",
    },
  };

  const OTHER_COLUMNS = {
    audit_logs: ["id", "actor_id", "action", "subject_type", "subject_id", "created_at"],
    categories: ["id", "parent_id", "name", "slug"],
    coupons: ["id", "code", "percent_off", "expires_at"],
    invoices: ["id", "customer_id", "order_id", "number", "issued_at", "due_at", "paid_at"],
    order_items: ["id", "order_id", "product_id", "quantity", "unit_price_cents"],
    payments: ["id", "order_id", "provider", "amount_cents", "status", "created_at"],
    products: ["id", "category_id", "sku", "name", "price_cents", "active"],
    refunds: ["id", "payment_id", "amount_cents", "reason", "created_at"],
    reviews: ["id", "product_id", "customer_id", "rating", "body", "created_at"],
    sessions: ["id", "user_id", "ip_address", "user_agent", "last_activity_at"],
    shipments: ["id", "order_id", "carrier", "tracking_number", "shipped_at", "delivered_at"],
    subscriptions: ["id", "customer_id", "plan", "status", "renews_at"],
    users: ["id", "customer_id", "email", "role", "last_login_at"],
    active_subscriptions: ["id", "customer_id", "plan", "renews_at"],
    monthly_revenue: ["month", "orders", "revenue"],
  };
  const tableList = [
    "active_subscriptions:view", "audit_logs", "categories", "coupons", "customers", "invoices", "monthly_revenue:view",
    "order_items", "orders", "payments", "products", "refunds", "reviews", "sessions", "shipments", "subscriptions", "users",
  ].map((entry) => {
    const [name, kind] = entry.split(":");
    return { name, kind: kind || "table", estimate: name === "orders" ? orders.length : 40 };
  });
  const allColumns = {};
  for (const [name, spec] of Object.entries(TABLES)) allColumns[name] = spec.columns.map((c) => c.name);
  Object.assign(allColumns, OTHER_COLUMNS);

  const csv = (rows, sentinel) =>
    rows
      .map((row) =>
        row
          .map((value) => {
            if (value === null || value === undefined) return sentinel;
            const text = String(value);
            return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
          })
          .join(","),
      )
      .join("\n") + "\n";

  const tableOf = (sql) => (sql.match(/table_name = '([^']+)'/) || sql.match(/"public"\."([^"]+)"/) || sql.match(/FROM "public"\."([^"]+)"/) || [])[1];

  const answer = async (sql) => {
    if (/lifetime_value/.test(sql)) { await sleep(34); return topCustomers(); }
    if (/avg_order_value/.test(sql)) { await sleep(28); return monthlyRevenue(); }
    if (/current_setting\('server_version'\)/.test(sql)) return [["v"], ["16.4"]];
    if (/FROM pg_database/.test(sql)) return [["datname"], ["acme_web_dev"], ["acme_web_test"], ["postgres"]];
    if (/FROM pg_namespace/.test(sql)) return [["nspname"], ["audit"], ["public"]];
    if (/FROM pg_class c/.test(sql)) return [["name", "kind", "estimate"]].concat(tableList.map((t) => [t.name, t.kind, t.estimate]));
    if (/table_name AS t, column_name AS c/.test(sql)) {
      return [["t", "c"]].concat(Object.entries(allColumns).flatMap(([t, cols]) => cols.map((c) => [t, c])));
    }
    const spec = TABLES[tableOf(sql)];
    if (/column_name AS name, data_type AS type/.test(sql) && spec) {
      return [["name", "type", "nullable", "dflt"]].concat(spec.columns.map((c) => [c.name, c.type, c.nullable ? "YES" : "NO", c.default]));
    }
    if (/i\.indisprimary/.test(sql) && spec) return [["name"]].concat(spec.columns.filter((c) => c.pk).map((c) => [c.name]));
    if (/FROM pg_indexes/.test(sql) && spec) return [["name", "definition"]].concat(spec.indexes);
    if (/contype = 'f'/.test(sql) && spec) return [["name", "definition"]].concat(spec.fks);
    if (/FROM pg_trigger/.test(sql) && spec) return [["name", "definition"]].concat(spec.triggers);
    if (/COUNT\(\*\) AS count/.test(sql) && spec) return [["count"], [spec.rows.length]];
    const page = sql.match(/^SELECT \* FROM "public"\."([^"]+)".* LIMIT (\d+) OFFSET (\d+)$/);
    if (page && TABLES[page[1]]) {
      const table = TABLES[page[1]];
      const names = table.columns.map((c) => c.name);
      const offset = Number(page[3]);
      return [names].concat(table.rows.slice(offset, offset + Number(page[2])).map((row) => names.map((n) => (n in row ? row[n] : null))));
    }
    return [];
  };

  h.set("exec", async (argv) => {
    const bin = argv[0];
    if (bin === "/usr/bin/which") return { exitCode: 0, stdout: "/usr/bin/" + argv[1] + "\n", stderr: "" };
    if (bin === "psql") {
      const sql = argv[argv.indexOf("-c") + 1] || "";
      const sentinel = (argv.find((a) => /^null=/.test(a)) || "null=").slice(5);
      return { exitCode: 0, stdout: csv(await answer(sql), sentinel), stderr: "" };
    }
    if (bin === "pg_dump") {
      const spec = TABLES[argv[argv.indexOf("-t") + 1].split(".").pop()];
      return { exitCode: 0, stdout: spec ? spec.ddl + "\n" : "", stderr: "" };
    }
    if (bin === "uname") return { exitCode: 0, stdout: "Linux\n", stderr: "" };
    return { exitCode: 0, stdout: "", stderr: "" };
  });

  const topCustomersSql = [
    "-- Top customers by lifetime value",
    "SELECT c.id, c.name, c.email, c.plan,",
    "       count(o.id) AS orders,",
    "       round(sum(o.total_cents) / 100.0, 2) AS lifetime_value,",
    "       max(o.placed_at) AS last_order_at",
    "FROM customers c",
    "JOIN orders o ON o.customer_id = c.id",
    "WHERE o.status IN ('paid', 'shipped')",
    "GROUP BY c.id",
    "ORDER BY lifetime_value DESC",
    "LIMIT 10;",
  ].join("\n");
  const monthlySql = [
    "-- Revenue and average order value per month",
    "SELECT to_char(date_trunc('month', placed_at), 'YYYY-MM') AS month,",
    "       count(*) AS orders,",
    "       round(sum(total_cents) / 100.0, 2) AS revenue,",
    "       round(avg(total_cents) / 100.0, 2) AS avg_order_value",
    "FROM orders",
    "WHERE status IN ('paid', 'shipped')",
    "GROUP BY 1",
    "ORDER BY 1 DESC;",
  ].join("\n");
  const pendingSql = "SELECT id, customer_id, total_cents, placed_at\nFROM orders\nWHERE status = 'pending'\nORDER BY placed_at;";
  h.memory.set("drafts:c-acme-dev", {
    tabs: [
      { id: 2, title: "Top customers", sql: topCustomersSql },
      { id: 3, title: "Monthly revenue", sql: monthlySql },
      { id: 4, title: "Pending orders", sql: pendingSql },
    ],
    activeId: 2,
  });

  const scene = h.data && h.data.scene;
  const text = (node) => (node.textContent || "").trim();
  const find = (selector, label) => [...document.querySelectorAll(selector)].find((n) => text(n) === label);
  const steps = {
    query: [
      () => { const b = find(".seg button", "Query"); if (b) b.click(); return !!b; },
      () => /lifetime_value/.test(document.querySelector(".cm-content")?.textContent || ""),
      () => { const b = find(".toolbar .btn-primary", "Run"); if (b) b.click(); return !!b; },
      () => document.querySelectorAll(".result-grid tbody tr").length >= 10,
    ],
    data: [
      () => { const r = find(".tree-row", "orders"); if (r) r.click(); return !!r; },
      () => document.querySelectorAll(".grid-table tbody tr").length > 20,
    ],
    structure: [
      () => { const r = find(".tree-row", "orders"); if (r) r.click(); return !!r; },
      () => { const b = find(".seg button", "Structure"); if (b) b.click(); return !!b; },
      () => !!document.querySelector(".ddl-block"),
    ],
  }[scene];
  window.__ready = !scene;
  if (steps) {
    let index = 0;
    const timer = setInterval(() => {
      if (index < steps.length && steps[index]()) index += 1;
      if (index === steps.length) { clearInterval(timer); window.__ready = true; }
    }, 200);
  } else {
    const timer = setInterval(() => {
      if (document.querySelector(".connection-row")) { clearInterval(timer); window.__ready = true; }
    }, 200);
  }
})();
