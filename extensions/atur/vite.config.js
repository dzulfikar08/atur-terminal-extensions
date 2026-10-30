import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  base: "./",
  resolve: {
    alias: {
      "@atur/ui": fileURLToPath(new URL("../../shared/ui", import.meta.url)),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    minify: false,
  },
});
