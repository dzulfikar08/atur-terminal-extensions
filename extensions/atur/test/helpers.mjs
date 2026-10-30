export function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    get: async (key) => (data.has(key) ? structuredClone(data.get(key)) : null),
    set: async (key, value) => void data.set(key, structuredClone(value)),
    delete: async (key) => void data.delete(key),
  };
}

export const reply = (status, body, headers = {}) => ({ status, headers, body: typeof body === "string" ? body : JSON.stringify(body) });

/** A fetch double that records calls and answers from a handler `(url, options) => reply`. */
export function fakeFetch(handler) {
  const calls = [];
  const fn = async (url, options = {}) => {
    calls.push({ url, ...options, form: options.body && options.headers?.["content-type"]?.includes("x-www-form-urlencoded") ? Object.fromEntries(new URLSearchParams(options.body)) : null });
    return handler(url, options, calls.length);
  };
  fn.calls = calls;
  return fn;
}

export const toolResult = (data) => ({ jsonrpc: "2.0", id: 1, result: { content: [{ type: "text", text: JSON.stringify(data) }] } });
