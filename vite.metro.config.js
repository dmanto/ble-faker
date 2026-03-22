// Separate vite config for the CJS metro helper.
// metro.config.js is CommonJS in the majority of React Native projects,
// so this entry point must be CJS to support require('ble-faker/metro').
import { defineConfig } from "vite";
import { builtinModules } from "module";

export default defineConfig({
  build: {
    lib: {
      entry: { metro: "src/metro.ts" },
      formats: ["cjs"],
      fileName: (_format, entryName) => `${entryName}.cjs`,
    },
    rollupOptions: {
      external: [...builtinModules, /node:/],
    },
    outDir: "dist",
    emptyOutDir: false,
    target: "node23",
  },
});
