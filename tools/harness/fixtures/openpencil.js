// Serves a design file through atur.files.readBytes/writeBytes for the OpenPencil case.
// The bytes come from --assets sample.fig=<path>, served at /__fixtures__/sample.fig.
(() => {
  const h = window.__harness;
  const store = new Map(); // project path -> Uint8Array written by the page
  h.reads = 0;
  h.writes = [];
  const toBase64 = (bytes) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(new Blob([bytes]));
    });
  const fromBase64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const source = async (path) => {
    if (store.has(path)) return store.get(path);
    const res = await fetch("/__fixtures__/" + path.split("/").pop());
    if (!res.ok) throw new Error("No such file: " + path);
    return new Uint8Array(await res.arrayBuffer());
  };
  h.set("files.readBytes", async (path) => {
    h.reads += 1;
    const bytes = await source(path);
    return { path, base64: await toBase64(bytes), size: bytes.length };
  });
  h.set("files.writeBytes", async (path, base64) => {
    const bytes = fromBase64(base64);
    store.set(path, bytes);
    h.writes.push({ path, size: bytes.length });
    return { path };
  });
  h.set("files.stat", async (path) => {
    const bytes = await source(path);
    return { path, name: path.split("/").pop(), isDirectory: false, size: bytes.length };
  });
  h.set("dialog.prompt", async ({ placeholder }) => placeholder);
})();
