# Project: ble-faker

`ble-faker` is a scriptable BLE (Bluetooth Low Energy) simulation toolchain. It enables developers to simulate complex hardware peripherals using JavaScript logic and interact with them from React Native apps without physical hardware.

## Core Architecture

The system consists of a **Simulation Server** (the engine running on the dev machine) and a **Client Bridge** (integrating with the mobile app).

---

## Implemented

### 1. The Simulation Engine

The server is a Node.js application started via `npx ble-faker --dir <path> --port <port>` (see `src/bin.ts`). It exposes the following HTTP routes:

- `GET /` — returns `{ version, dir }` as JSON.
- `GET /devices` — returns the current list of advertising devices as an array of `MockDeviceConfig` payloads (see §10).
- `WebSocket /bridge/:id` — per-device BLE bridge for characteristic simulation (see §11).
- `WebSocket /browser/:id` — browser dashboard real-time UI channel (see §12).

The server registers two helpers in `src/plugins.ts`:

- **`calculateAdvertizingSize`** — computes the byte length of an advertising packet and validates it against the 31-byte legacy BLE limit.
- **`runDeviceLogic`** — sandboxed execution engine for device `.js` logic files (see §5).

### 2. CLI Entry Point

`src/bin.ts` is a thin CLI argument parser — it imports `app` from `index.ts` (which registers all hooks and routes as a side effect) then delegates to the framework's `server` command via `app.cli.start()`. This bypasses the `detectImport` guard, which breaks under symlinks such as `npx` and `pnpm link`.

`bin.ts` also:

- Rejects `--cluster` with a clear error — in-memory device state is incompatible with multi-process workers.
- Registers process exit handlers to clean up the state file on unexpected termination:
  - **`process.on('exit', …)`** — fires synchronously on `process.exit()` and unhandled exceptions.
  - **`process.on('SIGINT', …)`** — fires on Ctrl+C.
  - **SIGTERM** is handled by the framework's `onStop` hook (see §3).
  - **SIGKILL** cannot be intercepted — the PID liveness check on next startup covers that case.

### 3. Server State File

`src/index.ts` registers two lifecycle hooks:

- **`onStart`** — writes `~/.ble-faker-server.json` containing `{ pid, url, port }` once the server is ready.
- **`onStop`** — deletes the state file on graceful SIGTERM shutdown.

Together with the `bin.ts` exit handlers, the state file is cleaned up for all termination scenarios except SIGKILL. Stale files from SIGKILL or hard crashes are detected on next startup via a PID liveness check (`process.kill(pid, 0)`).

### 4. `bleMockServer` Helper (`src/server-control.ts`)

A programmatic interface for use in tests and app-side mock code:

- `start({ dir, port })` — spawns the server by invoking `process.execPath` (the current Node binary) directly with `dist/bin.js`, then polls `GET /` until it responds (30s timeout). The bin path is resolved at runtime via `path.dirname(fileURLToPath(import.meta.url))` — **not** via `new URL("./bin.js", import.meta.url)`, which Vite would inline as a `data:` URL during the library build.
- `stop()` — kills the server process. On Windows uses `taskkill /F /T` to terminate the full process tree; on Linux/macOS kills the process group via `process.kill(-pid)`.
- `get()` — reads the state file to obtain the server URL, performs `GET /`, returns the parsed JSON body.

Exported from `src/index.ts` as `import { bleMockServer } from 'ble-faker'`.

### 5. Device Logic Sandbox (`runDeviceLogic`)

Device `.js` files export a single default function. A complete example showing all event kinds:

```js
export default function (state, event) {
  if (event.kind === "start") {
    return [
      { in: [{ name: "target", label: "Target HR" }] },
      { out: [{ name: "current", label: "Current HR" }] },
    ];
  }

  if (event.kind === "advertise") {
    return [{ name: "HR Monitor", rssi: -65, serviceUUIDs: ["180D"] }];
  }

  if (event.kind === "tick") {
    const hr = state.vars?.hr ?? 72;
    return [["2A37", utils.packUint16(hr)], { set: { current: String(hr) } }];
  }

  if (event.kind === "input" && event.id === "target") {
    return [{ vars: { hr: parseInt(event.payload, 10) } }];
  }

  return [];
}
```

`runDeviceLogic` executes this safely via `node:vm`:

- **Isolation**: runs in a `vm.createContext` sandbox. `process` and `require` are explicitly shadowed as `undefined` to prevent prototype-chain leakage from the Node.js host context.
- **ESM compatibility**: strips `export default` before evaluation so `vm.Script` can handle it.
- **Timeout**: configurable CPU limit (default 50ms) prevents runaway logic.
- **Available globals** (no imports needed): `Buffer`, `Uint8Array`, `DataView`, and a `utils` object with `toBase64`, `fromBase64`, `packUint16`.
- **`state`**: deep-cloned read-only input from the server. Contains four server-managed namespaces:
  - `state.dev` — full GATT profile from `gatt-profile.json`, including the `services` array. This is the complete payload passed to `addMockDevice()` on the app side.
  - `state.vars` — device-local values persisted from previous `{ vars: … }` return instructions.
  - `state.chars` — current characteristic values by UUID (`{ uuid: base64 }`).
  - `state.ui` — current browser UI controls (`{ ins: UiControl[], outs: UiControl[] }`).
  - Direct mutations to `state` are **silently discarded** — all writes go through return commands.
- **Result normalisation**: the return value is JSON round-tripped before leaving the helper, converting vm-context arrays/objects into host objects. This makes results safe to serialise and comparable with `deepEqual`.
- **Console capture**: `console.log/warn/error` inside logic files are captured into a `logs` array rather than written to stdout. Returns `DeviceLogicOutput { result, logs }`.

#### Event system

The `event` argument is a typed discriminated union (`DeviceEvent`):

| kind        | description                                                          |
| ----------- | -------------------------------------------------------------------- |
| `start`     | fired on every new bridge WebSocket connection                       |
| `tick`      | periodic 1-second timer (while a bridge is connected)               |
| `reload`    | mock file changed on disk (while a bridge is connected)             |
| `advertise` | fired on each `GET /devices` request to build the advertising packet |
| `notify`    | characteristic write from the app — `uuid` + `payload` (base64)    |
| `input`     | browser UI form submit — `id` + `payload`                            |

> **Note:** `start` fires on **every** new bridge connection, not just when the server starts. This allows per-connection state reset. `tick` and `reload` only fire while a bridge WebSocket is open.

#### Return format — command dispatch

Each item in the returned array is discriminated by shape:

| Item shape                      | Discriminant     | Effect                                                                                                         |
| ------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------- |
| `['2A37', base64]`              | `Array.isArray`  | Updates a GATT characteristic value                                                                            |
| `{ name, rssi, … }`             | plain object     | Patches `state.dev` (any `Partial<Device>` field)                                                              |
| `{ in: [{ name, label }] }`     | `'in' in item`   | Defines browser input controls: one label + text field + submit button per entry; submit POSTs → `input` event |
| `{ out: [{ name, label }] }`    | `'out' in item`  | Defines browser output display fields: one label + empty field per entry, `id` taken from `name`               |
| `{ set: { fieldName: 'val' } }` | `'set' in item`  | Pushes string values to named output fields in the browser via WebSocket                                       |
| `{ vars: { name: anyValue } }`  | `'vars' in item` | Persists any-typed values into `state.vars` for the next call — the only way to write device-local state       |

`in`/`out` definitions are typically returned from `start` and `reload` events.

> **Note:** `state` is read-only from the device code's perspective. Writing `state.hr = 42` inside the function will silently have no effect. Use `{ vars: { hr: 42 } }` instead.

### 6. Store Model (`src/models/store.ts`)

Defines the shared types and the in-memory device registry:

- **`DeviceState`** — `{ dev, vars, chars, ui }` — the full runtime state for one device.
- **`DeviceEntry`** — `{ id, categoryDir, jsFilePath, state, events }` — one registered device. The `events` field is a Node.js `EventEmitter` used to signal `reload`, `input`, and `remove` to active bridge connections.
- **`UiControl`** — `{ name, label }` — one browser input or output control.
- **`Store`** — `Map<id, DeviceEntry>` with `add/get/set/remove/has/all` methods, registered on `app.models.store` in `onStart`.
- **`sanitizeDeviceId(raw)`** — normalises a MAC string to lowercase with dashes.

`MojoModels` is augmented so `ctx.models.store` is typed as `Store`.

### 7. State Engine (`src/state-engine.ts`)

Pure functions — no persistent state, not a model, not accessed via `ctx.models`.

- **`emptyDeviceState()`** — returns a blank `DeviceState` with all fields empty.
- **`initDeviceState(categoryDir)`** — reads `<categoryDir>/gatt-profile.json`, puts the full parsed object into `state.dev` (services included), and initialises `state.chars` with an empty string for every characteristic UUID.
- **`applyCommands(result, current)`** — iterates the array returned by `runDeviceLogic`, applies each command to a shallow copy of `current`, and returns `{ state, wsMessages }`. Never mutates `current`. Invalid or unrecognised items are silently skipped.

### 8. GATT Labels & Default Device (`src/gatt-labels.ts`, `src/default-device.ts`)

- **`GATT_LABELS`** — `Record<string, string>` mapping ~120 standard GATT service and characteristic UUIDs to human-readable names. Covers Generic Access, Device Information, Heart Rate, Battery, Environmental Sensing, Blood Pressure, and more.
- **`DEFAULT_DEVICE_CODE`** — a static JavaScript string injected by the event processor when a device `.js` file is empty (zero bytes). At runtime it reads `state.dev.services` to wire characteristics automatically:
  - `read`/`notify` characteristics → `{ out: [{ name, label }] }`
  - `write` characteristics → `{ in: [{ name, label }] }`
  - Device name: `ESP32_` + last 5 hex chars of the MAC (from `state.dev.id`)
  - RSSI: −65 dBm
  - Labels resolved via `GATT_LABELS`; unknown UUIDs fall back to the raw UUID string.

### 9. File Watcher (`src/watcher.ts`)

Started in `onStart` via `startWatcher(dir, store)` using **chokidar**:

- **Initial scan** (synchronous): walks `<dir>/<category>/` subdirectories that contain a `gatt-profile.json`. For each `<MAC>.js` file found, calls `addDevice` which reads the profile into `initDeviceState`, sets `state.dev.id`, and registers the entry in the store.
- **Live watching**: after startup, chokidar watches for:
  - `add` — new `.js` file → `addDevice`
  - `change` — existing `.js` modified → emits `"reload"` on `entry.events` (picked up by any active bridge)
  - `unlink` — `.js` deleted → emits `"remove"` on `entry.events`, then removes from store

Device IDs must match the pattern `[0-9a-f]{2}(-[0-9a-f]{2}){5}` (MAC address with dashes). Files not matching this pattern are ignored.

### 10. `GET /devices` (`src/controllers/devices.ts`)

For each entry in the store, runs `runDeviceLogic` with `{ kind: "advertise" }` and applies the result via `applyCommands`. The resulting `state.dev` is the advertising packet. A default `rssi: -65` is injected if the device logic does not set one. Returns the array of dev objects as JSON.

This endpoint is polled by the app-side mock (`ble-faker/mock`) on scan start and every 5 seconds while scanning.

> **Note:** `GET /devices` does **not** persist the advertise result back to `entry.state`. The `advertise` event is stateless — `state.dev` is reset from the stored entry on each call. Use `state.vars` for values that must survive across calls.

### 11. BLE Bridge (`src/controllers/ble-bridge.ts`)

`WebSocket /bridge/:id` — opened by the app-side mock immediately after `connectToDevice` succeeds.

On each new connection:

1. **`start`** event fires — device logic initialises characteristics and UI. Any characteristic diff (new value ≠ stored value) is sent to the app immediately as `{ type: "char", uuid, value }`.
2. **Tick timer** fires every 1 second — drives `tick` events; diffs are forwarded to the app.
3. **`reload`** event — wired to `entry.events`; fires when the device `.js` file changes on disk.
4. **`input`** event — wired to `entry.events`; fires when the browser UI submits a form field.
5. **Incoming messages** (app → server): `{ uuid, payload }` objects are forwarded as `notify` events. The result is applied and diffs are sent back to the app.

On WebSocket close: tick timer and event listeners are removed.

The server sends characteristic updates **only for changed values** (diff against `entry.state.chars`), then writes the new state back to `entry.state`.

### 12. Browser Bridge (`src/controllers/browser-bridge.ts`)

`WebSocket /browser/:id` — opened by the browser dashboard for a specific device.

- On connect: emits the current UI definition to the browser.
- Forwards `set` messages (produced by `{ set: { field: value } }` commands) as real-time output field updates.
- Receives input form submits from the browser and fires `input` events on `entry.events`.

### 13. App-Side Mock (`src/mock.ts`, `ble-faker/mock`)

Exposed as the `./mock` package subpath (`dist/mock.js`). Acts as a drop-in replacement for `react-native-ble-plx` via Metro's module resolution hook.

#### Metro configuration (app side)

```js
// metro.config.js
const bleMock = process.env.BLE_MOCK === "true";
if (bleMock) {
  const bleFakerDir = fs.realpathSync(path.join(__dirname, "node_modules/ble-faker"));
  config.watchFolders = [bleFakerDir];
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === "react-native-ble-plx") {
      return { filePath: path.join(bleFakerDir, "dist/mock.js"), type: "sourceFile" };
    }
    return context.resolveRequest(context, moduleName, platform);
  };
}
```

`fs.realpathSync` is required because `node_modules/ble-faker` may be a symlink (e.g. `pnpm link` or `file:` dep); Metro needs the real path in `watchFolders`.

#### `BleManager` subclass

Re-exports the full surface of `react-native-ble-plx-mock` and replaces `BleManager` with a subclass:

```ts
export class BleManager extends MockManager {
  constructor(options: { bleFakerPort?: number } = {}) {
    super();
    // Derive server URL from Expo dev server host + configured port
    this._url = deriveServerUrl(options.bleFakerPort ?? 3000);

    this.onStartScan(() => { /* poll immediately, then every 5s */ });
    this.onStopScan(() => { /* clear interval */ });
  }
}
```

#### Polling loop (scanning)

Runs inside the RN app. Uses only `fetch` and `expo-constants` (no Node.js built-ins):

1. Derive server URL from `Constants.expoConfig.hostUri` (Expo dev server host) + port.
2. `GET /devices` — if unreachable, treat as empty list.
3. `clearMockDevices()` unconditionally.
4. `addMockDevice(d)` for each device. Also builds a `charUUID → serviceUUID` lookup map for the WS bridge.

An `inProgress` flag prevents overlapping polls.

#### WebSocket bridge (per connected device)

Opened immediately after `connectToDevice` succeeds (`/bridge/:id`), closed on `cancelDeviceConnection`.

- **App → server** (`writeCharacteristicWith[out]ResponseForDevice`): forwards `{ uuid, payload }` over the WS. A write queue buffers messages sent while the WS is still in the `CONNECTING` state; they are flushed on `open`.
- **Server → app** (`onmessage`): receives `{ type: "char", uuid, value }` and calls `setCharacteristicValue` to update the mock characteristic, triggering any registered monitors.
- **Reconnect safety**: `_openBridge` always calls `_closeBridge` first to prevent stale WS instances. The `onclose` handler guards with an identity check (`ws === current`) so a closing stale socket cannot clobber a newer one.

### 14. Tests

49 tests across 7 files, run in parallel via `node --test test/**/*.test.ts`:

| file                            | what it covers                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `test/advertising-size.test.ts` | `calculateAdvertizingSize` helper (packet size arithmetic) — 5 tests                                                                        |
| `test/bridges.test.ts`          | `ble-bridge` and `browser-bridge` WebSocket controllers — 4 tests                                                                           |
| `test/default-device.test.ts`   | `DEFAULT_DEVICE_CODE` via `runDeviceLogic` — 8 tests covering start/reload/input/unknown events and edge cases                              |
| `test/device-logic.test.ts`     | `runDeviceLogic` sandbox — 14 tests covering core behaviour, utils, console capture, state isolation, error handling, and sandbox security  |
| `test/devices.test.ts`          | `GET /devices` endpoint — 6 tests covering empty store, device with id, serviceUUIDs, isConnectable, rssi fallback, and multiple devices    |
| `test/server.test.ts`           | `bleMockServer` lifecycle — spawns a real server, verifies state file round-trip, stops it — 1 test                                         |
| `test/state-engine.test.ts`     | `applyCommands` (10 tests) and `initDeviceState` (1 test)                                                                                   |

`test/fixtures/heart-rate-monitors/` contains the shared device fixture used across multiple suites.

### 15. CI

Three-platform matrix (ubuntu, macos, windows) via `.github/workflows/ci.yml`, running `pnpm build:test` on Node 23. Automatic release PR management via `release-please`. Typical run times: Ubuntu fastest, macOS ~26s, Windows ~46s (Windows overhead is inherent — NTFS + Defender — not test execution time).

---

## Planned

### Heartbeat

The server will touch the state file's mtime every ~5 seconds (`setInterval`, `.unref()`'d) as a liveness signal. On next startup, mtime age provides a secondary stale-file check that survives PID reuse.
