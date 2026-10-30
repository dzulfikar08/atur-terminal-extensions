// Allow-list HTML sanitizer for issue descriptions and comments (rich text from
// other people, rendered inside the extension page). String based so it behaves
// the same in the webview and in tests: every tag is rebuilt from scratch, only a
// short list of formatting tags survives, and the only attribute kept is a
// web link's `href` (exposed as `data-href`, opened by the app's own browser).

const ALLOWED = new Set([
  "p", "br", "strong", "b", "em", "i", "u", "s", "code", "pre", "ul", "ol", "li",
  "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "a", "hr", "span", "div",
]);
const VOID = new Set(["br", "hr"]);
const DROP_WITH_CONTENT = new Set(["script", "style", "iframe", "object", "embed", "template", "noscript", "textarea", "svg", "math"]);
const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;

const escapeText = (value) => value.replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttribute = (value) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function decodeEntities(value) {
  return value
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex) => String.fromCodePoint(Math.min(parseInt(hex, 16), 0x10ffff)))
    .replace(/&#(\d+);?/g, (_, dec) => String.fromCodePoint(Math.min(Number(dec), 0x10ffff)))
    .replace(/&(amp|lt|gt|quot|apos|colon|tab|newline);/gi, (_, name) =>
      ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", colon: ":", tab: "\t", newline: "\n" })[name.toLowerCase()]);
}

function safeHref(attributes) {
  const match = /(?:^|\s)href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i.exec(attributes);
  if (!match) return null;
  const decoded = decodeEntities(match[1] ?? match[2] ?? match[3] ?? "").replace(/[\u0000-\u0020]/g, "");
  return /^https?:\/\//i.test(decoded) ? decoded : null;
}

export function sanitizeHtml(input) {
  const source = String(input ?? "");
  const out = [];
  const open = [];
  let last = 0;
  let skipUntil = null;
  TAG.lastIndex = 0;
  for (let match = TAG.exec(source); match; match = TAG.exec(source)) {
    const [whole, closing, rawName, attributes] = match;
    const name = rawName.toLowerCase();
    if (skipUntil) {
      if (closing && name === skipUntil) {
        skipUntil = null;
        last = match.index + whole.length;
      }
      continue;
    }
    out.push(escapeText(source.slice(last, match.index)));
    last = match.index + whole.length;
    if (!closing && DROP_WITH_CONTENT.has(name)) {
      skipUntil = name;
      continue;
    }
    if (!ALLOWED.has(name)) continue;
    if (closing) {
      const index = open.lastIndexOf(name);
      if (index === -1) continue;
      while (open.length > index) out.push(`</${open.pop()}>`);
      continue;
    }
    if (name === "a") {
      const href = safeHref(attributes);
      out.push(href ? `<a data-href="${escapeAttribute(href)}">` : "<a>");
    } else {
      out.push(`<${name}>`);
    }
    if (!VOID.has(name)) open.push(name);
  }
  if (!skipUntil) out.push(escapeText(source.slice(last)));
  while (open.length) out.push(`</${open.pop()}>`);
  return out.join("");
}
