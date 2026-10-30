import { registerCustomCSSVariableTheme } from "@pierre/diffs";

export const ATUR_TERM_DIFF_THEME = "atur-diffs";

const tint = (mix, base = "var(--atur-foreground)") =>
  `color-mix(in srgb, ${base} ${mix}%, var(--atur-accent) ${100 - mix}%)`;

const VARIABLE_DEFAULTS = {
  foreground: "var(--atur-foreground)",
  background: "var(--atur-background)",
  "token-comment": "var(--atur-foreground-muted)",
  "token-string": tint(35),
  "token-string-expression": tint(35),
  "token-keyword": tint(15),
  "token-constant": tint(45),
  "token-function": tint(25),
  "token-parameter": "var(--atur-foreground)",
  "token-punctuation": "var(--atur-foreground-muted)",
  "token-link": "var(--atur-accent)",
  "token-inserted": "var(--atur-diff-add)",
  "token-deleted": "var(--atur-diff-remove)",
  "token-changed": "var(--atur-diff-hunk)",
};

export const HEADER_CSS = `
[data-diffs-header][data-diffs-header] {
  cursor: pointer;
  background-color: var(--bg);
  background-image: linear-gradient(var(--diff-header-bg), var(--diff-header-bg));
  border-bottom: 1px solid var(--diff-header-border);
  min-height: 0;
  height: calc(34px * var(--diff-zoom, 1));
}
[data-diffs-header][data-diffs-header]:hover {
  background-image: linear-gradient(var(--diff-header-hover), var(--diff-header-hover));
}
[data-diffs-header] [data-title] {
  font-weight: 600;
}
`;

let registered = false;

export function registerAturDiffTheme() {
  if (registered) return ATUR_TERM_DIFF_THEME;
  registerCustomCSSVariableTheme(ATUR_TERM_DIFF_THEME, VARIABLE_DEFAULTS, true);
  registered = true;
  return ATUR_TERM_DIFF_THEME;
}
