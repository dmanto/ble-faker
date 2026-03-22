# Changelog

## [0.2.0](https://github.com/dmanto/ble-faker/compare/ble-faker-v0.1.0...ble-faker-v0.2.0) (2026-03-22)


### Features

* add ble-faker/device types subpath for IDE support in device files ([9865897](https://github.com/dmanto/ble-faker/commit/98658974eb5eb878c36eb257e7763c68a1e0f10e))
* add ble-faker/mock subpath for React Native BLE simulation ([222f2e6](https://github.com/dmanto/ble-faker/commit/222f2e6fc551658df7c4f41ea4d6170328f4db4e))
* add browser dashboard and namespace UI infrastructure ([e69d5ed](https://github.com/dmanto/ble-faker/commit/e69d5ed9c4df4e48cfcaf9d81bd2b2e2b9df9792))
* add custom ble-faker favicon ([7cd5ed1](https://github.com/dmanto/ble-faker/commit/7cd5ed15d5f0e2871323bedcf7f98db93d933619))
* add DeviceStore model and state engine ([34ddcd5](https://github.com/dmanto/ble-faker/commit/34ddcd585e323554dc87114acdf01336ebbadff5))
* add error simulation commands (disconnect, readError, clearReadError) ([105b841](https://github.com/dmanto/ble-faker/commit/105b841ef4e67b3b4f722c34e9bbb27317061d1d))
* add file watcher and WebSocket bridges ([687e2f5](https://github.com/dmanto/ble-faker/commit/687e2f56c7f8e241118046a167b84a49bd9e2539))
* add GATT labels table and default device code ([f2bb782](https://github.com/dmanto/ble-faker/commit/f2bb782c4582fdf0400e88b93c66a168f2ab91fe))
* add GET /devices endpoint for app-side device discovery ([1b06212](https://github.com/dmanto/ble-faker/commit/1b0621294b068e40958eca4011b58c994fbabda2))
* add npx CLI entry point, update architecture docs ([773a4de](https://github.com/dmanto/ble-faker/commit/773a4de586f667ef99471cb4230e77a80b7f4460))
* add runDeviceLogic sandbox helper with typed DeviceEvent ([6daf9f7](https://github.com/dmanto/ble-faker/commit/6daf9f74b82ffc584949f3151cbb26b27b2e7ef0))
* add runDeviceLogic tests; fix vm sandbox and prototype issues ([f23e110](https://github.com/dmanto/ble-faker/commit/f23e1101ed9bbf028a3eeb9046de11505652375c))
* add server state file, bleMockServer helper, and lifecycle test ([f754745](https://github.com/dmanto/ble-faker/commit/f75474503466ea16738acc0a05fbc516e995de09))
* add test control HTTP API and ble-faker/test client ([45888c8](https://github.com/dmanto/ble-faker/commit/45888c8e421ed0276405a19bf7eef4882cfc036c))
* add WebSocket bridge tests and fix build for mojo.js controller discovery ([b014913](https://github.com/dmanto/ble-faker/commit/b014913c6d81c40dd67eb7afc8fe5b9057fb6903))
* add withBleFaker() Metro helper and document RNTL integration ([49a9c42](https://github.com/dmanto/ble-faker/commit/49a9c4205bee75a39001edc5591ccceefe1cc6ab))
* bridge characteristic reads/writes/notifications to ble-faker server ([9655bf0](https://github.com/dmanto/ble-faker/commit/9655bf05a052ab07cf80314d4a073d54d48bebae))
* **bridge:** add force disconnect, bridge status, and production mode ([f576c3f](https://github.com/dmanto/ble-faker/commit/f576c3f781aaa1f9d793d2884b373ae28782bd7c))
* **bridge:** forward device console logs to server stdout ([62a8ab1](https://github.com/dmanto/ble-faker/commit/62a8ab1da95ec269cee10d08bfe35f4893d088cf))
* capture sandbox console output for browser view delivery ([e2118a5](https://github.com/dmanto/ble-faker/commit/e2118a530ba2f584569f186fc378ce31a82f3a39))
* **examples:** add smart-bulb demo device for article/recording ([ad5b238](https://github.com/dmanto/ble-faker/commit/ad5b238bcf21b1e3e383edd65ae1fdfcb3b0de14))
* rename to ble-faker, add release pipeline, fix TypeScript config ([9737391](https://github.com/dmanto/ble-faker/commit/97373917535b76c778dfd0bb82502dac196129c3))
* **sandbox:** expand utils and add TextEncoder/TextDecoder to vm sandbox ([43d7747](https://github.com/dmanto/ble-faker/commit/43d77474d6052fecfc3ca7fee4f1477847bdd1a5))
* **test-client:** add tickN, forceDisconnect, waitForChar, lastOutput/lastChar ([34ee507](https://github.com/dmanto/ble-faker/commit/34ee5071a399685f1c72c6ea12ec9d21964c5c3b))
* **test:** add disableAutoTick option to mount ([fc23367](https://github.com/dmanto/ble-faker/commit/fc23367c91fee99316fec855fe9355cdfbfe9b75))


### Bug Fixes

* add type casts to state-engine tests to satisfy noUncheckedIndexedAccess ([76ad449](https://github.com/dmanto/ble-faker/commit/76ad44971d50a892166d26fe0858c94d2ed81707))
* **bridge:** send all explicit char commands unconditionally, without diff check ([143357b](https://github.com/dmanto/ble-faker/commit/143357bde4a717a74dd7b28ccd4dc4dd1aa1e55a))
* clean process tree shutdown on all platforms ([4ce51e6](https://github.com/dmanto/ble-faker/commit/4ce51e6d9f1be6b944f8365de2ce75ecc7e54198))
* clean up state file on crash and Ctrl+C in bin.ts ([d14c474](https://github.com/dmanto/ble-faker/commit/d14c47436736a1d52c137f49109efe55b76c8233))
* coerce undefined device logic return to [] to avoid JSON.parse crash ([fe0773e](https://github.com/dmanto/ble-faker/commit/fe0773e7c41c6e54b14f3bc586052ccc99b8724e))
* do not re-root relative imports from ble-faker in Metro resolver ([3acfb4f](https://github.com/dmanto/ble-faker/commit/3acfb4fa7cad5cef3c183c7f0ddf2c936df9ea06))
* **examples:** rewrite smart-bulb as DeviceLogicFn (was wrongly using object handlers) ([754188c](https://github.com/dmanto/ble-faker/commit/754188cf98952b06b6bb3b578a62296064358712))
* expose ./package.json in exports; add views/public to files ([cb6175a](https://github.com/dmanto/ble-faker/commit/cb6175ac115daebe365bd7bd12e31d9e24f76a65))
* generate .d.ts declarations and remove unnecessary type cast ([864448e](https://github.com/dmanto/ble-faker/commit/864448e26e20d36d4f326cc6a0367d2a416f3ea1))
* include views and public dirs in npm package files ([54e5a7b](https://github.com/dmanto/ble-faker/commit/54e5a7b4fe63d9d93d80f51d4a87d6bbd7334e2d))
* increase server start timeout to 30s; run test files sequentially ([c019743](https://github.com/dmanto/ble-faker/commit/c01974355dd3c2aeaac0b61c94fb2ee2bb3f7422))
* **mock:** detect Metro host via expo-constants in Expo dev client ([8f8b47c](https://github.com/dmanto/ble-faker/commit/8f8b47c2d419be81d626bb33a98f8fc2cce5ff19))
* **mock:** expose platform-correct device IDs to app code ([817e1a9](https://github.com/dmanto/ble-faker/commit/817e1a9caa945d1a6adb36546c383ef9ac7783a1))
* **mock:** prevent stale WS bridge from clobbering new bridge on reconnect ([6ce8eaa](https://github.com/dmanto/ble-faker/commit/6ce8eaadc8e700c11d0077d48b8e7b53676a49b2))
* **mock:** remove simulateDeviceDisconnection from disconnect flow ([bc73d3f](https://github.com/dmanto/ble-faker/commit/bc73d3f9cfd5203a144b668368981a86ec359600))
* normalize controller entry paths for Windows in vite.config.js ([82250d0](https://github.com/dmanto/ble-faker/commit/82250d0c2eb0f992b76e383b348239e2aae4f642))
* pin deps, move ble-plx-mock to deps, correct TS device docs ([b2fc715](https://github.com/dmanto/ble-faker/commit/b2fc7153f1e5fed8c6ef1a7927df627e208f42b8))
* re-enable parallel test execution ([ffc8594](https://github.com/dmanto/ble-faker/commit/ffc85942aa3bf972b522c4c9660e87cf12c13cab))
* spawn npx via cmd /c on Windows to avoid EINVAL on .cmd files ([1b85c29](https://github.com/dmanto/ble-faker/commit/1b85c29b42b14cb4301c0f52f73b3adc825f4f0b))
* sync pnpm-lock.yaml with package.json (react-native-ble-plx moved to devDependencies) ([1fd0d82](https://github.com/dmanto/ble-faker/commit/1fd0d821bffc35f12e1dd998ea78867b1ff7d291))
* update react-native-ble-plx-mock to 1.3.1 (act() fix for RNTL) and bump to 1.1.1 ([dadd167](https://github.com/dmanto/ble-faker/commit/dadd1677f52797ac2a1821e6094753e981138afe))
* update react-native-ble-plx-mock to 1.3.2 (react as peer dep, no inline bundle) ([dde0190](https://github.com/dmanto/ble-faker/commit/dde01904165b296bcf30fc09bd79c399051eea9d))
* use __dirname instead of import.meta.url in metro.cjs; add metro test suite ([11adee0](https://github.com/dmanto/ble-faker/commit/11adee07619797ce8a3f4136be5302eefc4e79ac))
* use ctx.urlForFile for favicon — public/ is served under /static/ ([7a74b58](https://github.com/dmanto/ble-faker/commit/7a74b58e97542a076ef1eb3398e73edc902be56f))
* use non-deprecated googleapis/release-please-action ([0e83e70](https://github.com/dmanto/ble-faker/commit/0e83e70530fe5d135931b55d35dbfa4166765efb))
* use shell:true on Windows instead of cmd /c for npx spawn ([f4cabb7](https://github.com/dmanto/ble-faker/commit/f4cabb7978b1fb033e840c38109b9cc223f7bc6c))
* **win32:** delete state file from stop command after taskkill ([903a81c](https://github.com/dmanto/ble-faker/commit/903a81cfcf547a6a356308ed48483d6b63f58816))


### Performance Improvements

* spawn node bin directly instead of npx to eliminate startup overhead ([8d2346a](https://github.com/dmanto/ble-faker/commit/8d2346a6f2c585957316c479c1e348d5851d8a73))

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
