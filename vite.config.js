import { defineConfig } from "vite";
import { builtinModules } from "module";
import fs from "node:fs";

// Auto-discover all controller files so mojo.js can import them dynamically at runtime.
// Adding a new src/controllers/*.ts file is enough — no manual registration needed.
const controllerEntries = Object.fromEntries(
  fs.globSync("src/controllers/*.ts").map((file) => [
    file.replace(/^src\//, "").replace(/\.ts$/, ""),
    file,
  ]),
);

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: "src/index.ts",
        bin: "src/bin.ts",
        ...controllerEntries,
      },
      formats: ["es"],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
    rollupOptions: {
      // Don't bundle Node built-ins or Mojo core
      external: [...builtinModules, /^@mojojs/, /node:/],
      output: {
        banner: (chunk) =>
          chunk.isEntry && chunk.name === "bin" ? "#!/usr/bin/env node\n" : "",
      },
    },
    outDir: "dist",
    target: "node23",
  },
});
