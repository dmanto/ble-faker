# CLI Entry Point (`npx ble-faker`)

## Goal

Allow users to run `npx ble-faker --dir ./mocks --port 58083` instead of `node dist/index.js server -l http://*:58083`.

## How It Works

- `src/bin.ts` is a separate entry point that parses `--dir`/`-d` and `--port`/`-p`, then delegates to the mojo.js `server` command via `app.cli.start()`.
- We call `app.cli.start("server", ...)` instead of `app.start()` to bypass mojo's `detectImport` guard, which relies on V8 stack introspection and breaks under symlinks (e.g. `npx`, `pnpm link`).
- Unknown flags are passed through to the mojo server (e.g. `--level trace`, `--cluster`).

## Build

- `vite.config.js` has two entry points: `index` and `bin`.
- Rollup's `banner` option adds `#!/usr/bin/env node` only to `dist/bin.js`.
- `postbuild` script runs `chmod +x dist/bin.js` for local testing.
- `package.json` declares `"bin": "dist/bin.js"` so npm/npx resolves the command.
