// Atur Terminal host script for the OpenPencil web app.
//
// OpenPencil is built for browsers and for its own desktop shell. Inside Atur Terminal it
// runs as an extension tab, so this script, loaded before the app's own modules,
//   * gives the app the browser file APIs it already knows (showOpenFilePicker,
//     showSaveFilePicker, FileSystemFileHandle) backed by `atur.files`, so
//     open, save and save-as work on the project's files;
//   * opens the file the tab was started with (`atur.data.filePath`);
//   * refuses network access to other hosts: this build has no network permission, and
//     OpenPencil's cloud, collaboration, AI and update features are off.
//
// Everything below is plain, readable source. The app bundle it sits beside is built
// from the pinned upstream commit named in upstream.json.
(() => {
  "use strict";

  const atur = window.atur;
  if (!atur) {
    console.error("OpenPencil: the Atur Terminal host API is not available in this page.");
    return;
  }

  // ---------------------------------------------------------------- address bar
  // The tab loads /index.html; the app's router only knows "/".
  try {
    if (location.pathname !== "/") history.replaceState(null, "", "/" + location.search + location.hash);
  } catch (_) { /* the router falls back to its default */ }

  // ---------------------------------------------------------------- network guard
  const BLOCKED = "Network access to other hosts is disabled in OpenPencil for Atur Terminal.";
  const isLocalURL = (value) => {
    try {
      const url = new URL(String(value), location.href);
      if (url.protocol === "blob:" || url.protocol === "data:" || url.protocol === "about:") return true;
      return url.protocol === location.protocol && url.host === location.host;
    } catch (_) {
      return false;
    }
  };
  const blocked = (what, url) => {
    console.warn(`[atur] blocked ${what} ${String(url)}`);
    return new TypeError(BLOCKED);
  };
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = input instanceof Request ? input.url : input;
    return isLocalURL(url) ? nativeFetch(input, init) : Promise.reject(blocked("fetch", url));
  };
  const nativeOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    if (!isLocalURL(url)) throw blocked("XMLHttpRequest", url);
    return nativeOpen.call(this, method, url, ...rest);
  };
  for (const name of ["WebSocket", "EventSource"]) {
    const Native = window[name];
    if (!Native) continue;
    const Guarded = function (url, ...rest) {
      if (!isLocalURL(url)) throw blocked(name, url);
      return new Native(url, ...rest);
    };
    Guarded.prototype = Native.prototype;
    for (const key of ["CONNECTING", "OPEN", "CLOSING", "CLOSED"]) if (key in Native) Guarded[key] = Native[key];
    window[name] = Guarded;
  }
  if (navigator.sendBeacon) navigator.sendBeacon = (url) => { blocked("sendBeacon", url); return false; };
  const nativeWindowOpen = window.open ? window.open.bind(window) : null;
  window.open = (url, ...rest) => {
    if (url == null || isLocalURL(url)) return nativeWindowOpen ? nativeWindowOpen(url, ...rest) : null;
    blocked("window.open", url);
    return null;
  };

  // ---------------------------------------------------------------- file helpers
  const basename = (path) => String(path).split("/").pop() || String(path);
  const normalize = (path) => String(path).replace(/\\/g, "/").replace(/^\.?\/+/, "").replace(/\/{2,}/g, "/");
  const DESIGN_FILE = /\.(fig|pen)$/i;
  const TEXT_FILE = /\.(pen|html?|xhtml|svg|json|txt|md)$/i;

  const reportError = (message) => {
    console.error("[atur] " + message);
    try {
      atur.toast({ title: "OpenPencil", body: String(message) });
    } catch (_) { /* toast is best effort */ }
  };

  function base64ToBytes(base64) {
    const clean = base64.replace(/\s+/g, "");
    const out = new Uint8Array(Math.floor((clean.length * 3) / 4) - (clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0));
    // atob in slices of 1 MiB of base64 text: large files never build one huge string.
    const SLICE = 1048576;
    let offset = 0;
    for (let at = 0; at < clean.length; at += SLICE) {
      const binary = atob(clean.slice(at, at + SLICE));
      for (let i = 0; i < binary.length; i += 1) out[offset + i] = binary.charCodeAt(i);
      offset += binary.length;
    }
    return out;
  }

  function bytesToBase64(bytes) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result);
        resolve(result.slice(result.indexOf(",") + 1));
      };
      reader.onerror = () => reject(reader.error || new Error("could not encode the file"));
      reader.readAsDataURL(new Blob([bytes], { type: "application/octet-stream" }));
    });
  }

  async function readProjectFile(path) {
    if (typeof atur.files.readBytes === "function") {
      const { base64 } = await atur.files.readBytes(path);
      return base64ToBytes(base64 || "");
    }
    if (!TEXT_FILE.test(path)) {
      throw new Error("This version of Atur Terminal can only read text files; update it to open " + basename(path));
    }
    const { content } = await atur.files.read(path);
    return new TextEncoder().encode(content);
  }

  async function writeProjectFile(path, bytes) {
    if (typeof atur.files.writeBytes === "function") {
      await atur.files.writeBytes(path, await bytesToBase64(bytes));
      return;
    }
    if (!TEXT_FILE.test(path)) {
      throw new Error("This version of Atur Terminal can only write text files; update it to save " + basename(path));
    }
    await atur.files.write(path, new TextDecoder().decode(bytes));
  }

  // A cheap fingerprint, used to tell our own writes from outside changes.
  function fingerprint(bytes) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < bytes.length; i += 1) {
      hash ^= bytes[i];
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return bytes.length + ":" + hash;
  }

  // ---------------------------------------------------------------- file handles
  // Per-path state lives here, not on the handle: the app may store handles in IndexedDB,
  // and a handle with only data properties survives structured cloning.
  const cache = new Map(); // path -> { file, print, modified, dirty }

  function invalidate(path) {
    const entry = cache.get(path);
    if (entry) entry.dirty = true;
  }

  async function currentFile(path) {
    const entry = cache.get(path);
    if (entry && !entry.dirty) return entry.file;
    const bytes = await readProjectFile(path);
    const print = fingerprint(bytes);
    const modified = entry && entry.print === print ? entry.modified : Date.now();
    const file = new File([bytes], basename(path), { type: "application/octet-stream", lastModified: modified });
    cache.set(path, { file, print, modified, dirty: false });
    return file;
  }

  class AturFileHandle {
    constructor(path) {
      this.kind = "file";
      this.path = normalize(path);
      this.name = basename(this.path);
    }
    async getFile() {
      return currentFile(this.path);
    }
    async createWritable() {
      return new AturWritable(this.path);
    }
    async isSameEntry(other) {
      return Boolean(other) && other.path === this.path;
    }
    async queryPermission() {
      return "granted";
    }
    async requestPermission() {
      return "granted";
    }
  }

  class AturWritable {
    constructor(path) {
      this._path = path;
      this._chunks = [];
      this._closed = false;
    }
    async write(data) {
      if (this._closed) throw new TypeError("The stream is closed.");
      const payload = data && typeof data === "object" && "type" in data && "data" in data && data.type === "write" ? data.data : data;
      if (typeof payload === "string") this._chunks.push(new TextEncoder().encode(payload));
      else if (payload instanceof Blob) this._chunks.push(new Uint8Array(await payload.arrayBuffer()));
      else if (ArrayBuffer.isView(payload)) this._chunks.push(new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength));
      else if (payload instanceof ArrayBuffer) this._chunks.push(new Uint8Array(payload));
      else throw new TypeError("Unsupported data for write().");
    }
    async truncate(size) {
      if (size !== 0) throw new TypeError("Only truncate(0) is supported.");
      this._chunks = [];
    }
    async seek(position) {
      if (position !== 0) throw new TypeError("Only seek(0) is supported.");
    }
    async abort() {
      this._closed = true;
      this._chunks = [];
    }
    async close() {
      if (this._closed) return;
      this._closed = true;
      const total = this._chunks.reduce((sum, c) => sum + c.length, 0);
      const bytes = new Uint8Array(total);
      let at = 0;
      for (const chunk of this._chunks) {
        bytes.set(chunk, at);
        at += chunk.length;
      }
      this._chunks = [];
      await writeProjectFile(this._path, bytes);
      const print = fingerprint(bytes);
      const modified = Date.now();
      cache.set(this._path, {
        file: new File([bytes], basename(this._path), { type: "application/octet-stream", lastModified: modified }),
        print,
        modified,
        dirty: false,
      });
    }
  }

  // Changes made outside the editor (the terminal, git, another tab).
  if (atur.events && typeof atur.events.subscribe === "function") {
    atur.events.subscribe("file.changed", (event) => {
      const changed = normalize((event && event.path) || "");
      if (!changed) return;
      for (const path of cache.keys()) {
        if (changed === path || changed.endsWith("/" + path)) invalidate(path);
      }
    });
  }

  // ---------------------------------------------------------------- pickers
  async function askPath(title, placeholder) {
    const answer = await atur.dialog.prompt({ title: title + " (path in the project)", placeholder });
    return answer ? normalize(answer) : null;
  }

  const abort = () => new DOMException("The user aborted a request.", "AbortError");

  window.showOpenFilePicker = async (options) => {
    const path = await askPath("Open design file", "designs/app.fig");
    if (!path) throw abort();
    if (!DESIGN_FILE.test(path) && !/\.(html?|xhtml)$/i.test(path)) {
      reportError("OpenPencil opens .fig and .pen files.");
      throw abort();
    }
    return [new AturFileHandle(path)];
  };

  window.showSaveFilePicker = async (options) => {
    const suggested = (options && options.suggestedName) || "Untitled.fig";
    const path = await askPath("Save design as", suggested);
    if (!path) throw abort();
    return new AturFileHandle(DESIGN_FILE.test(path) ? path : path + (/\.pen$/i.test(suggested) ? ".pen" : ".fig"));
  };

  // ---------------------------------------------------------------- opening files
  let opened = null; // the last path this tab opened
  async function openProjectFile(path) {
    const target = normalize(path);
    if (!target || opened === target) return;
    opened = target;
    const open = window.openPencil && window.openPencil.openDesignFile;
    if (typeof open !== "function") throw new Error("the editor is not ready yet");
    try {
      const handle = new AturFileHandle(target);
      const file = await handle.getFile();
      await open(file, handle);
      if (atur.tabs && typeof atur.tabs.setTitle === "function") atur.tabs.setTitle(basename(target)).catch(() => {});
    } catch (error) {
      opened = null;
      reportError(`Could not open ${target}: ${(error && error.message) || error}`);
    }
  }

  // The app starts after this script; wait for its editor, then open the tab's file.
  function whenEditorReady(callback) {
    const started = Date.now();
    const tick = () => {
      const api = window.openPencil;
      let ready = false;
      try {
        ready = Boolean(api && typeof api.openDesignFile === "function" && api.getStore && api.getStore());
      } catch (_) { /* store not created yet */ }
      if (ready) callback();
      else if (Date.now() - started < 120000) setTimeout(tick, 150);
      else reportError("The OpenPencil editor did not start.");
    };
    tick();
  }

  const requested = () => {
    const data = atur.data;
    return data && typeof data.filePath === "string" ? data.filePath : null;
  };

  whenEditorReady(() => {
    window.__aturOpenPencilReady = true;
    const initial = requested();
    if (initial) openProjectFile(initial);
    if (typeof atur.onDataChange === "function") {
      atur.onDataChange(() => {
        const next = requested();
        if (next) openProjectFile(next);
      });
    }
  });
})();
