# Changelog

## [1.3.5] - 2026-03-22

### Fixed

- Removed duplicate `react-native-ble-plx-mock` entry from `devDependencies` — it was already declared in `dependencies` (since 1.3.3) and the leftover devDep was redundant.

## [1.3.4] - 2026-03-22

### Fixed

- Removed unused `lodash` and `jsonpath-plus` from `dependencies` (and their `@types` from `devDependencies`). Neither package is imported anywhere in the source — they were dead entries carried over from early development.

## [1.3.3] - 2026-03-22

### Fixed

- **`react-native-ble-plx-mock` moved from `peerDependencies` to `dependencies`** — it is an internal implementation detail of the mock layer and should not require a manual install step from consumers.
- **`expo-constants` marked `optional: true` in `peerDependenciesMeta`** — bare React Native projects no longer see a peer dependency warning on install.
- **Pinned all `dependencies` to proper semver ranges** (`^1.26.12`, `^5.0.0`, etc.) instead of `"latest"`, ensuring reproducible installs across environments.
- **Added `engines: { node: ">=18" }`** to `package.json` so unsupported Node versions surface a clear error rather than cryptic failures.

### Changed

- **README: TypeScript device file example replaced with JSDoc approach** — device logic runs in a plain JavaScript sandbox (`node:vm`); TypeScript syntax causes a `SyntaxError` at runtime. The correct approach is JSDoc `@type` and `/// <reference types="ble-faker/device" />`, which gives full IDE autocompletion and event narrowing with no transpilation required.
- **README: documented `{ disconnect: true }` limitation** — the mock signals disconnection via a characteristic error on the first monitored characteristic. Apps that only monitor later characteristics in the GATT profile may not detect the simulated disconnect.
- **README: documented `BLE_FAKER_STATE` environment variable** in the CI section — overrides the default `~/.ble-faker-server.json` state file path, useful in CI environments where the home directory is not writable or shared across steps.

## [1.3.2] - 2026-03-22

### Fixed

- `ble-faker/metro`: `withBleFaker()` resolver was re-rooting relative imports (e.g. `./mock-config.js`) from inside ble-faker's `dist/` to the project root, causing Metro to fail to resolve `./mock-config.js` at bundle time. Added `!moduleName.startsWith(".")` guard so only bare-specifier imports are re-rooted. Added regression test.

## [1.3.1] - 2026-03-22

### Fixed

- `ble-faker/metro`: rollup's CJS conversion of `import.meta.url` produces `({}).url` (undefined), causing `fileURLToPath` to throw at load time. Replaced with `__dirname`, which is always available in CJS context and avoids the issue entirely.

## [1.3.0] - 2026-03-22

### Added

- **`ble-faker/metro`** — `withBleFaker(config, opts)` helper that replaces the 50-line manual Metro config boilerplate with a single call. Handles the `resolveRequest` redirect, the `/ble-faker-config` middleware, and `watchFolders` registration automatically. No-op unless the activation env var (`BLE_MOCK=true` by default) is set, so it is safe to apply unconditionally. Shipped as a CJS file (`dist/metro.cjs`) so it works with `require('ble-faker/metro')` in CommonJS `metro.config.js` files used by both Expo and bare React Native projects.
- **TypeScript device logic** — documented the `ble-faker/device` types subpath with a `.ts` device file example using `DeviceState` and `DeviceEvent`.
- **Full sandbox utils table** — README now documents all pack/unpack helpers (`packUint8`, `packInt8`, `packInt16`, `packUint32`, `packFloat32`, `unpackUint8`–`unpackFloat32`) with their byte order and signatures.
- **RNTL / Jest section** — full step-by-step setup guide for React Native Testing Library integration: `jest.config.js` with `moduleNameMapper`, `globalSetup`/`globalTeardown` files, and an annotated test file example.
- **`dev:mock` combined script** — documented a single `concurrently`-based script that starts both the ble-faker server and Metro together.

### Fixed

- Mock now emits an actionable error message when Metro does not serve `/ble-faker-config`, including a hint about `BLE_MOCK=true` and `withBleFaker()`.

## [1.2.2] - 2026-03-22

### Fixed

- `mock-config`: replaced `Symbol.for`/`globalThis` with a plain module-level variable. `Symbol.for` is per-realm in V8 — in Jest's `vm.createContext()` sandbox the symbol registry is isolated from the outer process, making cross-module sharing unreliable. Since `dist/mock-config.js` is a proper separate entry point (not inlined by rollup), Jest's module cache guarantees one instance per test file, so a module-level variable is the correct and sufficient mechanism.
- Moved `react-native-ble-plx` from `dependencies` to `devDependencies`. It is only needed for TypeScript types during ble-faker's own build — app developers already have it installed, and vite marks it as external so it was never bundled. Having it in `dependencies` caused a redundant transitive installation alongside the app's own copy.

## [1.2.1] - 2026-03-21

### Fixed

- `bleMockServer.start()` now waits for the state file (`~/.ble-faker-server.json`) to exist before resolving, not just for the HTTP server to answer. Previously there was a race where the `onStart` hook that writes the state file could fire after the first HTTP response, causing `BleTestClient.connect()` in Jest `globalSetup` to read a missing or stale file.

## [1.2.0] - 2026-03-21

### Added

- **Jest-mode mock injection** — `BleTestClient.mount()` now writes the namespace URLs directly into the mock via a `globalThis`-backed shared channel (`Symbol.for('ble-faker.mock-config')`). In Jest/RNTL tests the mock skips the Metro `/ble-faker-config` fetch and the secondary `/mount` call entirely, eliminating the `global.fetch` monkey-patch previously required in `jest.setup.ts`. The Metro path is unchanged.
- **`BleTestClient.connectTo(url)`** — static factory that accepts a server URL directly, without reading `~/.ble-faker-server.json`. Useful for tests that start the server programmatically and already know the URL.
- **`dist/mock-config.js`** — internal shared-state module exposed as a build artifact (not a public `exports` entry) so the `Symbol.for` channel is testable and rollup keeps it as a proper module reference rather than inlining it into each bundle.

## [1.1.3] - 2026-03-20

### Fixed

- State engine: device logic that returns `undefined` (e.g. a `disconnect` handler with no return) no longer crashes with `SyntaxError: "undefined" is not valid JSON`. Coerced to `[]` before JSON round-trip.

## [1.1.2] - 2026-03-20

### Fixed

- Mock: update to react-native-ble-plx-mock@1.3.2 which declares `react` as a peer dependency, preventing React from being bundled inline and ensuring `act()` wrapping uses the correct React instance in RNTL tests.

## [1.1.1] - 2026-03-20

### Fixed

- Mock: wrap characteristic listener callbacks in React `act()` when `IS_REACT_ACT_ENVIRONMENT` is set, eliminating "not wrapped in act()" warnings in RNTL tests (via react-native-ble-plx-mock@1.3.1, closes #6).

## [1.1.0] - 2026-03-18

### Added

- `disableAutoTick` option on `client.mount()` (and the `POST /mount` body) — when `true`, the 1-second auto-tick interval is not started for that namespace. Use this in automated full-stack tests to keep device state deterministic and driven entirely by `tickN`.

### Fixed

- Mock: `simulateDeviceDisconnection` removed from the disconnect flow — the app's disconnection detection is driven solely by the characteristic error, which already carries the "was disconnected" message that triggers monitor handlers correctly.

## [1.0.3] - 2026-03-16

### Fixed

- Added `"license": "MIT"` field to `package.json` so the npm license badge displays correctly.
- Added `keywords` to `package.json` for better npm discoverability.

## [1.0.0] - 2026-03-14

### Added

- **`connect` / `disconnect` events** — device logic now receives a `connect` event on every new BLE bridge connection and a `disconnect` event when the bridge closes. Variables written during a session persist across reconnects.
- **`start` event redefined as NVM init** — `start` fires once on namespace creation and again on file change (hot-reload). `state.vars` is always empty at `start` time, making it the right place to initialise persistent state.
- **Console log forwarding** — `console.log` / `console.warn` / `console.error` calls inside device logic are forwarded to the ble-faker server's stdout, prefixed with the device ID.
- **Test client (`ble-faker/test`)** — `BleTestClient`, `BleNamespace`, and `BleDevice` classes for automated integration testing of device logic. Methods: `input`, `tickN`, `forceDisconnect`, `waitForOutput`, `waitForChar`, `lastOutput`, `lastChar`.
- **`forceDisconnect` command** — device logic can return `{ disconnect: true }` to simulate a BLE disconnection from the device side.
- **`readError` / `clearReadError` commands** — device logic can simulate characteristic read errors for specific UUIDs.
- **`ble-faker/device` types subpath** — TypeScript types for device event payloads and return values; import in device files for IDE autocompletion without runtime cost.
- **Expanded sandbox utilities** — `TextEncoder` / `TextDecoder` available inside device logic VM sandbox.
- **Platform-correct advertised device IDs** — mock exposes Android-style (`AA:BB:CC:DD:EE:FF`) and iOS-style (`XXXXXXXX-XXXX-4000-8000-XXXXXXXXXXXX`) IDs to app code automatically.
- **Metro host auto-detection** — mock reads the Metro dev server host via `expo-constants` so it works correctly on real devices (not just simulators).
- **Favicon** for the browser dashboard.
- **Full README** — Getting Started guide, Metro config instructions, Device Logic Reference, and Testing section.

### Changed

- **Explicit char commands are always sent** — returning `['uuid', base64]` from device logic now broadcasts the value unconditionally, without diffing against the previous value. Ensures the app always receives the intended notification.
- Proactive char push on bridge connect removed; device logic controls all characteristic updates explicitly.
- Production mode enabled by default for the mojo.js app.

### Fixed

- Mock: stale WebSocket bridge no longer clobbers a newly opened bridge on reconnect.
- Mock: `stop` command correctly cleans up the PID state file on Windows after `taskkill`.
- Favicon served via `ctx.urlForFile` so the `public/` directory resolves correctly under the `/static/` prefix.

## [0.1.1] - 2026-03-08

### Added

- **Browser dashboard** (`GET /ns/:token`) — live HTML UI for each namespace. Lists all devices, opens a WebSocket per device, and renders `in`/`out` controls defined by device logic in real time.
- Shared layout (`views/layouts/default.html.tmpl`) used by both the namespace index and dashboard views.
- `namespaces#show` controller action and `show_namespace` route.
- Tests for `GET /ns/:token` (200 HTML, device cards present) and 404 for unknown token.
- Root index now links to the dashboard instead of the raw JSON devices endpoint.

### Fixed

- `docs/mojo-way.md` content block syntax: `<{block}>` (no spaces) is the correct mojo.js form; the spaced variant `<{ block }>` is silently ignored by the template engine.

## [0.1.0] - initial release
