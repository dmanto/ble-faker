# Changelog

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
