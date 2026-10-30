// Stands in for the Atur Terminal host in the test harness: a `window.atur` whose
// documented namespaces exist, return neutral values, and can be overridden by a
// fixture through `__harness.set("files.list", async path => [...])`.
(() => {
  const cfg = window.__harness;
  const THEMES = {
    dark: {
      background: "#1e1e1e", foreground: "#e6e6e6", foregroundMuted: "#9d9d9d",
      surface: "rgba(255,255,255,0.05)", surfaceSolid: "#2a2a2a", border: "rgba(255,255,255,0.10)",
      hover: "rgba(255,255,255,0.08)", accent: "#d4d4d4", accentForeground: "#1e1e1e",
      accentSoft: "rgba(255,255,255,0.14)", diffAdd: "#3fb950", diffRemove: "#f85149", diffHunk: "#8b8b8b",
      colorScheme: "dark", topbarHeight: "38px",
    },
    light: {
      background: "#ffffff", foreground: "#1e1e1e", foregroundMuted: "#6b6b6b",
      surface: "rgba(0,0,0,0.04)", surfaceSolid: "#f2f2f2", border: "rgba(0,0,0,0.12)",
      hover: "rgba(0,0,0,0.06)", accent: "#3a3a3a", accentForeground: "#ffffff",
      accentSoft: "rgba(0,0,0,0.10)", diffAdd: "#1a7f37", diffRemove: "#cf222e", diffHunk: "#6b6b6b",
      colorScheme: "light", topbarHeight: "38px",
    },
  };
  const theme = Object.freeze({ ...THEMES[cfg.theme] });

  // console capture, read back by the harness
  window.__log = [];
  for (const level of ["log", "info", "warn", "error", "debug"]) {
    const original = console[level].bind(console);
    console[level] = (...args) => {
      try {
        window.__log.push(level + ": " + args.map((a) => (a instanceof Error ? a.stack || a.message : typeof a === "string" ? a : JSON.stringify(a))).join(" "));
      } catch (_) { /* ignore */ }
      original(...args);
    };
  }
  window.addEventListener("error", (e) => window.__log.push("uncaught: " + e.message + " @" + e.filename + ":" + e.lineno));
  window.addEventListener("unhandledrejection", (e) => window.__log.push("unhandledrejection: " + (e.reason && (e.reason.stack || e.reason.message) || e.reason)));

  const paint = () => {
    const root = document.documentElement;
    if (!root) return false;
    for (const [key, value] of Object.entries(theme)) {
      const name = key.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
      for (const prefix of ["--atur-", "--muxy-"]) root.style.setProperty(prefix + name, value);
    }
    root.style.colorScheme = theme.colorScheme;
    return true;
  };
  if (!paint()) document.addEventListener("readystatechange", paint, { once: true });
  new MutationObserver(() => { paint(); }).observe(document, { childList: true });

  const overrides = new Map();
  const listeners = new Map();
  const memory = new Map();

  const lazy = (path) => {
    const fn = async (...args) => {
      const impl = overrides.get(path);
      if (impl) return impl(...args);
      return null;
    };
    return new Proxy(fn, {
      get(_target, prop) {
        if (prop === "then" || typeof prop === "symbol") return undefined;
        return lazy(path ? path + "." + String(prop) : String(prop));
      },
    });
  };

  const emit = (name, payload) => {
    for (const callback of [...(listeners.get(name) || [])]) {
      try { callback(payload || {}); } catch (e) { console.error(e); }
    }
  };

  const base = {
    extensionID: cfg.owner,
    tabInstanceID: "tab-1",
    panelID: null,
    data: cfg.data,
    theme,
    focused: true,
    onDataChange: () => () => {},
    onThemeChange: () => () => {},
    onFocus: () => () => {},
    events: {
      subscribe(name, callback) {
        if (!listeners.has(name)) listeners.set(name, new Set());
        listeners.get(name).add(callback);
        return () => listeners.get(name).delete(callback);
      },
      emit: async (name, payload) => emit(name, payload),
    },
    storage: {
      get: async (key) => (memory.has(key) ? memory.get(key) : null),
      set: async (key, value) => { memory.set(key, value); },
      delete: async (key) => { memory.delete(key); },
    },
    toast: async (message) => { window.__log.push("toast: " + JSON.stringify(message)); },
    lifecycle: { onBeforeClose: () => () => {}, close: async () => {} },
    tabs: {
      setTitle: async (title) => { window.__title = title; },
      setIcon: async () => {},
      open: async () => "tab-2",
    },
    popover: { close: async () => {}, resize: async () => {} },
  };

  const atur = new Proxy(base, {
    get(target, prop) {
      if (prop in target) {
        const value = target[prop];
        if (value && typeof value === "object" && !(prop === "theme" || prop === "data")) {
          // namespace with explicit members: unknown members fall through to the lazy mock
          return new Proxy(value, {
            get(inner, member) {
              if (member in inner) return inner[member];
              if (typeof member === "symbol" || member === "then") return undefined;
              return lazy(String(prop) + "." + String(member));
            },
          });
        }
        return value;
      }
      if (typeof prop === "symbol" || prop === "then") return undefined;
      return lazy(String(prop));
    },
  });

  window.__harness.set = (path, impl) => overrides.set(path, impl);
  window.__harness.emit = emit;
  window.__harness.memory = memory;
  window.__harness.base = base;
  window.atur = window.muxy = atur;
})();
