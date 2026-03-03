import { defineConfig } from "vite";
import { builtinModules } from "module";
import fs from "node:fs";
import path from "node:path";

// Auto-discover all controller files so mojo.js can import them dynamically at runtime.
// Adding a new src/controllers/*.ts file is enough — no manual registration needed.
// path.relative + posix join handles backslash paths on Windows.
const controllerEntries = Object.fromEntries(
  fs.globSync("src/controllers/*.ts").map((file) => [
    path.relative("src", file).replace(/\.ts$/, "").split(path.sep).join("/"),
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
