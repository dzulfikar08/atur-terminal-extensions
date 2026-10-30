// Sample project for the review extension: git/find/cat output served through atur.exec.
(() => {
  const h = window.__harness;
  const scene = (h.data && h.data.scene) || "diff";
  const ROOT = "/home/dev/acme-web";
  const ago = (hours) => new Date(Date.now() - hours * 3600 * 1000).toISOString();
  const sha = (n) => (n.toString(16).padStart(6, "0") + "c3a91f07d2b84e65a0f1d9c8b7e6a5f4d3c2b1").slice(0, 40);

  // A file is a list of [kind, text]: " " unchanged, "+" added, "-" removed (shown as a diff).
  const files = {
    "src/checkout/submit.ts": [
      [" ", "import { db } from \"../db\";"],
      [" ", "import { chargeCard } from \"../payments\";"],
      ["+", "import { sendReceipt } from \"../email/receipt\";"],
      [" ", "import type { Cart, Order } from \"../types\";"],
      [" ", ""],
      [" ", "export class CheckoutError extends Error {}"],
      [" ", ""],
      [" ", "export async function submitOrder(cart: Cart): Promise<Order> {"],
      [" ", "  if (cart.items.length === 0) {"],
      [" ", "    throw new CheckoutError(\"Cart is empty\");"],
      [" ", "  }"],
      [" ", ""],
      [" ", "  const total = cart.items.reduce((sum, item) => sum + item.price * item.qty, 0);"],
      ["-", "  const order = await db.orders.insert({ cartId: cart.id, total, status: \"pending\" });"],
      ["+", "  const order = await db.orders.insert({ cartId: cart.id, total, status: \"pending\" });"],
      ["+", "  const payment = await chargeCard(cart.paymentMethod, total);"],
      ["+", "  if (!payment.ok) {"],
      ["+", "    await db.orders.update(order.id, { status: \"failed\" });"],
      ["+", "    throw new CheckoutError(payment.reason);"],
      ["+", "  }"],
      [" ", ""],
      ["-", "  return order;"],
      ["+", "  const confirmed = await db.orders.update(order.id, { status: \"confirmed\" });"],
      ["+", "  await sendReceipt(confirmed);"],
      ["+", "  return confirmed;"],
      [" ", "}"],
    ],
    "src/auth/session.ts": [
      [" ", "import { randomBytes } from \"node:crypto\";"],
      [" ", ""],
      [" ", "const SESSION_TTL_MS = 1000 * 60 * 60 * 8;"],
      [" ", ""],
      [" ", "export interface Session {"],
      [" ", "  id: string;"],
      [" ", "  userId: string;"],
      ["+", "  provider: \"password\" | \"github\" | \"gitlab\";"],
      [" ", "  expiresAt: number;"],
      [" ", "}"],
      [" ", ""],
      ["-", "export function createSession(userId: string): Session {"],
      ["+", "export function createSession(userId: string, provider: Session[\"provider\"] = \"password\"): Session {"],
      [" ", "  return {"],
      [" ", "    id: randomBytes(24).toString(\"hex\"),"],
      [" ", "    userId,"],
      ["+", "    provider,"],
      [" ", "    expiresAt: Date.now() + SESSION_TTL_MS,"],
      [" ", "  };"],
      [" ", "}"],
    ],
    "src/auth/oauth.ts": [
      ["+", "import { createSession } from \"./session\";"],
      ["+", ""],
      ["+", "export async function handleCallback(provider: \"github\" | \"gitlab\", code: string) {"],
      ["+", "  const profile = await exchangeCode(provider, code);"],
      ["+", "  return createSession(profile.userId, provider);"],
      ["+", "}"],
    ],
    "src/cart/totals.ts": [
      [" ", "import type { Cart } from \"../types\";"],
      [" ", ""],
      [" ", "export function cartTotal(cart: Cart): number {"],
      [" ", "  return cart.items.reduce((sum, item) => sum + item.price * item.qty, 0);"],
      [" ", "}"],
    ],
    "src/db.ts": [[" ", "export const db = createClient(process.env.DATABASE_URL);"]],
    "README.md": [[" ", "# acme-web"], [" ", ""], [" ", "Storefront for Acme."], ["+", ""], ["+", "Sign in with GitHub or GitLab is configured in `.env`."]],
    "package.json": [[" ", "{"], [" ", "  \"name\": \"acme-web\","], [" ", "  \"version\": \"2.4.0\""], [" ", "}"]],
  };
  const untracked = new Set(["src/auth/oauth.ts"]);
  const allPaths = [
    "README.md", "package.json", "src/db.ts", "src/cart/totals.ts", "src/checkout/submit.ts",
    "src/auth/session.ts", "src/auth/oauth.ts", "src/auth/login.ts", "src/payments.ts",
    "tests/checkout.test.ts", "tests/session.test.ts",
  ].sort();
  const porcelain = [
    " M README.md", " M src/checkout/submit.ts", "M  src/auth/session.ts", "?? src/auth/oauth.ts",
  ];
  const changedPaths = ["README.md", "src/auth/oauth.ts", "src/auth/session.ts", "src/checkout/submit.ts"];

  const content = (path) => (files[path] || [[" ", "// " + path]]).filter(([k]) => k !== "-").map(([, t]) => t).join("\n") + "\n";
  const diffFor = (path) => {
    const spec = files[path];
    if (!spec) return "";
    if (untracked.has(path)) return "@@ -0,0 +1," + spec.length + " @@\n" + spec.map(([, t]) => "+" + t).join("\n") + "\n";
    let out = "", oldLn = 1, newLn = 1, i = 0;
    while (i < spec.length) {
      if (spec[i][0] === " ") { oldLn++; newLn++; i++; continue; }
      const oldStart = oldLn, newStart = newLn, dels = [], adds = [];
      while (i < spec.length && spec[i][0] !== " ") {
        if (spec[i][0] === "-") { dels.push(spec[i][1]); oldLn++; } else { adds.push(spec[i][1]); newLn++; }
        i++;
      }
      out += "@@ -" + (dels.length ? oldStart : oldStart - 1) + "," + dels.length + " +" + (adds.length ? newStart : newStart - 1) + "," + adds.length + " @@\n";
      out += dels.map((t) => "-" + t + "\n").join("") + adds.map((t) => "+" + t + "\n").join("");
    }
    return "--- a/" + path + "\n+++ b/" + path + "\n" + out;
  };

  const commits = [
    ["fix(checkout): confirm the order after payment succeeds", "Maya Chen", "2 hours ago"],
    ["feat(auth): add OAuth callback for GitHub and GitLab", "Leo Park", "5 hours ago"],
    ["chore: upgrade to Node 22", "Sam Ortiz", "9 hours ago"],
    ["docs: document environment variables", "Priya Nair", "1 day ago"],
    ["refactor(cart): extract totals into a helper", "Maya Chen", "2 days ago"],
    ["test: cover the denied-consent path", "Leo Park", "3 days ago"],
  ].map(([s, a, d], i) => [sha(0xa1f0 - i * 0x111), a, d, s]);

  const comments = [
    {
      id: "c1a2b3c4d5e6f708", file: "src/checkout/submit.ts", line: 16, snippet: "const payment = await chargeCard(cart.paymentMethod, total);",
      status: "open", createdAt: ago(3), sentAt: null,
      messages: [{ author: "user", body: "Should we retry once on a transient gateway error before failing the order?", at: ago(3) }],
    },
    {
      id: "d2b3c4d5e6f70819", file: "src/checkout/submit.ts", line: 23, endLine: 25, snippet: "const confirmed = await db.orders.update(...)",
      status: "resolved", createdAt: ago(6), sentAt: ago(5.9),
      messages: [
        { author: "user", body: "Send the receipt only after the status update is committed.", at: ago(6) },
        { author: "agent", body: "Done: the receipt is now sent after the update resolves, in submit.ts.", at: ago(5.5) },
      ],
    },
    {
      id: "e3c4d5e6f708192a", file: "src/auth/session.ts", line: 8, snippet: "provider: \"password\" | \"github\" | \"gitlab\";",
      status: "in-progress", createdAt: ago(4), sentAt: ago(1),
      messages: [{ author: "user", body: "Extract the provider union into a shared type.", at: ago(4) }],
    },
  ];

  const sessionFile = scene === "refmenu" ? "src/auth/session.ts" : "src/checkout/submit.ts";
  localStorage.setItem("review:viewmode", "source");
  localStorage.setItem("review:session:" + ROOT, JSON.stringify({ file: sessionFile, scroll: 0, scope: scene === "refmenu" ? "all" : "changed", ref: null }));
  localStorage.setItem("review:pane:comments", JSON.stringify({ open: scene !== "refmenu", size: 260 }));
  localStorage.setItem("review:expanded:all:" + ROOT, JSON.stringify(["src", "src/auth", "src/checkout", "tests"]));
  localStorage.setItem("review:expanded:changed:" + ROOT, JSON.stringify(["src", "src/auth", "src/checkout"]));

  h.set("worktrees.list", async () => [{ id: "w1", path: ROOT, name: "acme-web", isActive: true }]);
  h.set("projects.list", async () => [{ id: "p1", name: "acme-web", path: ROOT, isActive: true }]);
  h.set("panes.list", async () => []);
  h.set("exec", async (req) => {
    const script = (req && req.argv && req.argv[2]) || "";
    const env = (req && req.env) || {};
    const ok = (stdout) => ({ stdout, stderr: "", exitCode: 0 });
    if (script.includes("REVIEW_OP")) {
      return env.REVIEW_OP === "read" ? ok(JSON.stringify({ comments })) : ok("");
    }
    if (script.includes("--max-count=500")) return ok(commits.map(([s, a, d, subj]) => [s, s.slice(0, 7), a, d, subj].join("\x1f")).join("\n"));
    if (script.includes("REVIEW_MODE")) {
      const list = env.REVIEW_MODE === "changed" ? changedPaths : allPaths;
      return ok(list.join("\n") + "\n" + env.REVIEW_SEP + "\n" + porcelain.join("\n") + "\n" + env.REVIEW_SEP + "\nfeature/oauth-login\n");
    }
    if (script.includes("exec cat")) return ok(content(env.REVIEW_FILE));
    if (script.includes("git diff --no-color")) return ok(diffFor(env.REVIEW_FILE));
    return ok("");
  });

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const until = async (test) => { for (let i = 0; i < 100 && !test(); i += 1) await sleep(100); };
  window.addEventListener("load", async () => {
    await until(() => document.querySelector(".cm-content") && document.querySelector(".cm-line"));
    await sleep(1200);
    if (scene === "refmenu") {
      document.querySelector("#ref-picker").click();
      await sleep(500);
    }
    window.__ready = true;
  });
})();
