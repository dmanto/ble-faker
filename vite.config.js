import { defineConfig } from "vite";
import { builtinModules } from "module";

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: "src/index.ts",
        bin: "src/bin.ts",
      },
      formats: ["es"],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
    rollupOptions: {
      // Don't bundle Node built-ins or Mojo core
      external: [...builtinModules, /^@mojojs/, /node:/],
      output: {
        banner: (chunk) =>
          chunk.isEntry && chunk.name === "bin"
            ? "#!/usr/bin/env node\n"
            : "",
      },
    },
    outDir: "dist",
    target: "node23",
  },
});
