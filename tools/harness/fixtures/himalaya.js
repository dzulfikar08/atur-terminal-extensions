// Sample mailbox for the himalaya extension: Himalaya CLI output served through atur.exec.
(() => {
  const h = window.__harness;
  const ago = (hours) => new Date(Date.now() - hours * 3600 * 1000).toISOString();
  const seen = [{ raw: "\\Seen", iana: "Seen" }];
  const addr = (name, email) => [{ name, email }];

  const envelopes = [
    { id: "412", subject: "Review requested: Add OAuth login (#128)", from: addr("Maya Chen", "maya@acme.example"), date: ago(1), flags: [], "has-attachment": false },
    { id: "411", subject: "Your weekly deploy digest for acme-web", from: addr("Acme Deploys", "deploys@acme.example"), date: ago(3), flags: [], "has-attachment": true },
    { id: "410", subject: "Re: Staging database migration window", from: addr("Leo Park", "leo@acme.example"), date: ago(6), flags: seen, "has-attachment": false },
    { id: "409", subject: "Invoice 2026-0412 from Northwind Hosting", from: addr("Northwind Billing", "billing@northwind.example"), date: ago(20), flags: [], "has-attachment": true },
    { id: "408", subject: "Design sync notes and action items", from: addr("Priya Nair", "priya@acme.example"), date: ago(27), flags: seen, "has-attachment": false },
    { id: "407", subject: "CI failed on main: e2e / checkout.spec.ts", from: addr("CI Bot", "ci@acme.example"), date: ago(31), flags: seen, "has-attachment": false },
    { id: "406", subject: "Welcome to the Acme engineering newsletter", from: addr("Acme Engineering", "news@acme.example"), date: ago(52), flags: seen, "has-attachment": false },
    { id: "405", subject: "Security notice: new sign-in from Linux", from: addr("Acme Accounts", "no-reply@acme.example"), date: ago(75), flags: seen, "has-attachment": false },
    { id: "404", subject: "Lunch on Thursday?", from: addr("Sam Ortiz", "sam@acme.example"), date: ago(98), flags: seen, "has-attachment": false },
    { id: "403", subject: "Quarterly roadmap draft (v2)", from: addr("Priya Nair", "priya@acme.example"), date: ago(130), flags: seen, "has-attachment": true },
    { id: "402", subject: "Re: Pairing session on the checkout flow", from: addr("Leo Park", "leo@acme.example"), date: ago(160), flags: seen, "has-attachment": false },
  ];

  const bodies = {
    "412": [
      "Hi,",
      "",
      "I opened pull request #128, \"Add OAuth login with GitHub provider\", and would",
      "appreciate your review before Thursday.",
      "",
      "What changed",
      "  - New /auth/github redirect and callback routes",
      "  - Login page gets a provider button and an error state",
      "  - Session cookie is now SameSite=Lax and rotated on sign-in",
      "",
      "How to try it",
      "  1. git fetch origin && git checkout feature/login",
      "  2. npm install && npm run dev",
      "  3. Open http://localhost:3000/login and click \"Sign in with GitHub\"",
      "",
      "All checks are green. The denied-consent path has a test in",
      "auth/callback.test.ts, and I left a few questions inline on the session",
      "handling.",
      "",
      "Thanks!",
      "Maya",
    ].join("\n"),
  };

  const mailboxes = [
    { name: "INBOX", desc: "\\HasNoChildren", unread: 3 },
    { name: "Archive", desc: "\\Archive", unread: 0 },
    { name: "Drafts", desc: "\\Drafts", unread: 0 },
    { name: "Sent", desc: "\\Sent", unread: 0 },
    { name: "Trash", desc: "\\Trash", unread: 0 },
  ];

  h.set("settings.get", async () => null);
  h.set("exec", async (argv) => {
    const ok = (stdout) => ({ stdout, stderr: "", exitCode: 0 });
    if (argv[0] === "/usr/bin/which") return ok("/usr/bin/himalaya\n");
    const args = argv.slice(1).filter((a) => a !== "--json");
    if (args[0] === "account") return ok(JSON.stringify({ accounts: [{ name: "work", backend: "IMAP", default: true }] }));
    if (args[0] === "mailbox") return ok(JSON.stringify({ mailboxes }));
    if (args[0] === "envelope") return ok(JSON.stringify({ envelopes }));
    if (args[0] === "message" && args[1] === "read") {
      const id = args[args.length - 1] === "INBOX" ? args[args.length - 3] : args[args.length - 1];
      const found = args.find((a) => bodies[a]);
      return ok(bodies[found || id] || "");
    }
    return ok("");
  });

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const until = async (test) => { for (let i = 0; i < 100 && !test(); i += 1) await sleep(100); };
  window.addEventListener("load", async () => {
    await until(() => document.querySelector(".mail-row"));
    if (window.__harness.data?.open) {
      document.querySelector(".mail-row").click();
      await until(() => document.querySelector(".mail-msg-text")?.textContent.includes("pull request"));
    }
    await sleep(300);
    window.__ready = true;
  });
})();
