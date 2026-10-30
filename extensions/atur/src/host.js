// The only file that touches `window.atur`, so everything else stays testable.

const host = () => {
  if (!window.atur) throw new Error("Atur Terminal's extension API is unavailable.");
  return window.atur;
};

export const isPanel = () => Boolean(window.atur?.panelID);

export const storage = {
  get: async (key) => host().storage.get(key),
  set: async (key, value) => host().storage.set(key, value),
  delete: async (key) => host().storage.delete(key),
};

/** `atur.http.fetch` (asks the user once per host) reshaped for the auth/MCP clients. */
export async function fetchFn(url, options = {}) {
  const response = await host().http.fetch(url, options);
  return { status: response.status, headers: response.headers || {}, body: response.body || "" };
}

/** The focused terminal pane, with the server session id when the host reports it. */
export async function activePane() {
  const panes = (await host().panes.list()) || [];
  return panes.find((pane) => pane.isFocused) || null;
}

export async function readScreen(paneId, lines = 80) {
  return (await host().panes.readScreen(paneId, lines)) || "";
}

export async function openBrowser(url) {
  return host().browser.open(url);
}

export async function listBrowserTabs() {
  return (await host().browser.list()) || [];
}

export async function closeBrowserTab(tabId) {
  await host().browser.close(tabId);
}

export async function openWorkspaceTab(data) {
  await host().tabs.open({ kind: "extensionWebView", extension: { id: "atur", tabType: "workspace", data, singleton: true } });
}

export function toast(title, body) {
  host().toast({ title, body }).catch(() => {});
}

export function subscribe(events, callback) {
  const stops = events.map((name) => host().events.subscribe(name, callback));
  return () => stops.forEach((stop) => stop());
}

export const onFocus = (callback) => host().onFocus(callback);
export const onDataChange = (callback) => host().onDataChange(callback);
export const data = () => host().data || {};
export const setTitle = (title) => host().tabs.setTitle(title).catch(() => {});
