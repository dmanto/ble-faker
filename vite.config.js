import { defineConfig } from "vite";
import { builtinModules } from "module";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: "index",
    },
    rollupOptions: {
      // Don't bundle Node built-ins or Mojo core
      external: [...builtinModules, /^@mojojs/, /node:/],
    },
    outDir: "dist",
    target: "node23",
  },
});
