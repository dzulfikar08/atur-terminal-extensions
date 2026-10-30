// Lucide-style glyphs as raw path data; rendered as inline SVG strings.
const PATHS = {
  refresh: ["M21 12a9 9 0 1 1-2.64-6.36", "M21 4v5h-5"],
  caret: ["m6 9 6 6 6-6"],
  back: ["m15 18-6-6 6-6"],
  external: ["M15 3h6v6", "M10 14 21 3", "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"],
  check: ["M20 6 9 17l-5-5"],
  bell: ["M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10.3 21a1.94 1.94 0 0 0 3.4 0"],
  send: ["m22 2-7 20-4-9-9-4Z", "M22 2 11 13"],
  user: ["M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2", "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8"],
  terminal: ["m4 17 6-6-6-6", "M12 19h8"],
  expand: ["M15 3h6v6", "M9 21H3v-6", "m21 3-7 7", "m3 21 7-7"],
  out: ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "m16 17 5-5-5-5", "M21 12H9"],
};

export function icon(name, size = 14) {
  const paths = PATHS[name].map((d) => `<path d="${d}"/>`).join("");
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}
