# Changelog

## [0.2.0](https://github.com/dmanto/ble-faker/compare/ble-faker-v0.1.0...ble-faker-v0.2.0) (2026-03-18)


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
* re-enable parallel test execution ([ffc8594](https://github.com/dmanto/ble-faker/commit/ffc85942aa3bf972b522c4c9660e87cf12c13cab))
* spawn npx via cmd /c on Windows to avoid EINVAL on .cmd files ([1b85c29](https://github.com/dmanto/ble-faker/commit/1b85c29b42b14cb4301c0f52f73b3adc825f4f0b))
* use ctx.urlForFile for favicon — public/ is served under /static/ ([7a74b58](https://github.com/dmanto/ble-faker/commit/7a74b58e97542a076ef1eb3398e73edc902be56f))
* use non-deprecated googleapis/release-please-action ([0e83e70](https://github.com/dmanto/ble-faker/commit/0e83e70530fe5d135931b55d35dbfa4166765efb))
* use shell:true on Windows instead of cmd /c for npx spawn ([f4cabb7](https://github.com/dmanto/ble-faker/commit/f4cabb7978b1fb033e840c38109b9cc223f7bc6c))
* **win32:** delete state file from stop command after taskkill ([903a81c](https://github.com/dmanto/ble-faker/commit/903a81cfcf547a6a356308ed48483d6b63f58816))


### Performance Improvements

* spawn node bin directly instead of npx to eliminate startup overhead ([8d2346a](https://github.com/dmanto/ble-faker/commit/8d2346a6f2c585957316c479c1e348d5851d8a73))

## [Unreleased]

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
