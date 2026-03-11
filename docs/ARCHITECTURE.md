# Project: ble-faker

`ble-faker` is a scriptable BLE (Bluetooth Low Energy) simulation toolchain. It enables developers to simulate complex hardware peripherals using JavaScript logic and interact with them from React Native apps without physical hardware.

## Core Architecture

The system consists of a **Simulation Server** (the engine running on the dev machine) and a **Client Bridge** (integrating with the mobile app).

---

## Implemented

### 1. The Simulation Engine

The server is a Node.js application started via `npx ble-faker --port <port>` (see `src/bin.ts`). It exposes the following HTTP routes:

- `GET /` — renders an HTML namespace index page listing all active namespaces with links to their dashboards.
- `POST /mount` — creates a new namespace for a given directory; returns `{ token, label, devicesUrl, bridgeUrl, browserUrl }`.
- `GET /ns/:token` — renders the browser dashboard for a namespace (see §13).
- `GET /ns/:token/devices` — returns the advertising device list for the namespace (see §11).
- `WebSocket /ns/:token/bridge/:id` — per-device BLE bridge for characteristic simulation (see §11).
- `WebSocket /ns/:token/browser/:id` — browser dashboard real-time UI channel (see §12).
- `DELETE /ns/:token` — destroys a namespace and its watcher.
- `POST /ns/:token/test/:id` — inject an input event into a device from test code (see §17).
- `GET /ns/:token/test/:id` — long-poll for a device output from test code (see §17).

All `/ns/:token/*` routes are guarded by a `namespaces#load` under-action that resolves the token to a `Namespace` object in the stash, returning 404 if not found.

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

- **`onStart`** — writes the state file containing `{ pid, url, port }` as soon as the app boots. Because `onStart` fires before the TCP port is actually bound, `url` is synthesised from `app.config.port` rather than read from `server.urls`.
- **`onStop`** — deletes the state file on graceful SIGTERM shutdown.

The default state file path is `~/.ble-faker-server.json`. The `BLE_FAKER_STATE` environment variable overrides it — used by the test suite to isolate each test's state file.

Together with the `bin.ts` exit handlers, the state file is cleaned up for all termination scenarios except SIGKILL. Stale files from SIGKILL or hard crashes are detected on next startup via a PID liveness check (`process.kill(pid, 0)`).

### 4. `bleMockServer` Helper (`src/server-control.ts`)

A programmatic interface for use in tests and app-side mock code:

- `start({ port })` — spawns the server by invoking `process.execPath` (the current Node binary) directly with `dist/bin.js`, then polls `GET /` until it responds (30s timeout). The bin path is resolved at runtime via `path.dirname(fileURLToPath(import.meta.url))` — **not** via `new URL("./bin.js", import.meta.url)`, which Vite would inline as a `data:` URL during the library build.
- `stop()` — kills the server process. On Windows uses `taskkill /F /T` to terminate the full process tree; on Linux/macOS kills the process group via `process.kill(-pid)`.
- `mount({ dir, label })` — calls `POST /mount` and returns `{ token, label, devicesUrl, bridgeUrl, browserUrl }`.
- `unmount(token)` — calls `DELETE /ns/:token`.

Exported from `src/index.ts` as `import { bleMockServer } from 'ble-faker'`.

### 5. Device Logic Sandbox (`runDeviceLogic`)

Device `.js` files export a single default function. A complete example showing all event kinds:

```js
/// <reference types="ble-faker/device" />

/** @type {import('ble-faker/device').DeviceLogicFn} */
export default function (state, event) {
  if (event.kind === "start") {
    // Fires on namespace creation and file change — acts as NVM init.
    // state.vars is always empty here; set initial non-volatile values.
    return [
      { vars: { hr: 72 } },
      { in: [{ name: "target", label: "Target HR" }] },
      { out: [{ name: "current", label: "Current HR" }] },
    ];
  }

  if (event.kind === "connect") {
    // Fires on every new BLE bridge connection — use for per-connection setup.
    return [];
  }

  if (event.kind === "advertise") {
    return [{ name: "HR Monitor", rssi: -65, serviceUUIDs: ["180D"] }];
  }

  if (event.kind === "tick") {
    const hr = state.vars.hr ?? 72;
    return [["2A37", utils.packUint16(hr)], { set: { current: String(hr) } }];
  }

  if (event.kind === "input" && event.id === "target") {
    return [{ vars: { hr: parseInt(event.payload, 10) } }];
  }

  if (event.kind === "disconnect") {
    // Fires after the bridge WS closes. vars updates still persist;
    // char/bridge messages have nowhere to go.
    return [];
  }

  return [];
}
```

`runDeviceLogic` executes this safely via `node:vm`:

- **Isolation**: runs in a `vm.createContext` sandbox. `process` and `require` are explicitly shadowed as `undefined` to prevent prototype-chain leakage from the Node.js host context.
- **ESM compatibility**: strips `export default` before evaluation so `vm.Script` can handle it.
- **Timeout**: configurable CPU limit (default 50ms) prevents runaway logic.
- **Available globals** (no imports needed): `Buffer`, `Uint8Array`, `DataView`, `TextEncoder`, `TextDecoder`, and a `utils` object (see below). All standard ECMAScript built-ins (`Math`, `Date`, `JSON`, `Promise`, `Map`, `Set`, `RegExp`, `Error`, etc.) are also available — they come from the JS engine, not Node.js, so no explicit injection is needed.
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

| kind           | description                                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `start`        | fired on namespace creation and on every device `.js` file change — use to initialise `state.vars` (NVM semantics)     |
| `connect`      | fired on every new BLE bridge WebSocket connection — use for per-connection setup                                       |
| `disconnect`   | fired after the BLE bridge WebSocket closes — `vars` updates persist; char/bridge messages have nowhere to go           |
| `tick`         | periodic 1-second timer (only while a bridge is connected)                                                              |
| `advertise`    | fired on each `GET /ns/:token/devices` request to build the advertising packet                                          |
| `notify`       | characteristic write from the app — `uuid` + `payload` (base64)                                                        |
| `input`        | browser UI form submit — `id` + `payload`                                                                               |

> **Note:** `start` is a **device NVM init event** — it fires when the namespace is created (server boot or `POST /mount`) and again whenever the device `.js` file changes on disk. It does **not** fire on BLE reconnection. `state.vars` is always empty when `start` fires; whatever you write there via `{ vars: … }` acts as non-volatile memory that persists across multiple BLE connections until the next `start` event. Use `connect` for per-connection setup. `tick` only fires while a bridge WebSocket is open.

#### Return format — command dispatch

Each item in the returned array is discriminated by shape:

| Item shape                        | Discriminant          | Effect                                                                                                         |
| --------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------- |
| `['2A37', base64]`                | `Array.isArray`       | Updates a GATT characteristic value                                                                            |
| `{ name, rssi, … }`               | plain object fallback | Patches `state.dev` (any `Partial<Device>` field)                                                              |
| `{ in: [{ name, label }] }`       | `'in' in item`        | Defines browser input controls: one label + text field + submit button per entry; submit POSTs → `input` event |
| `{ out: [{ name, label }] }`      | `'out' in item`       | Defines browser output display fields: one label + empty field per entry, `id` taken from `name`               |
| `{ set: { fieldName: 'val' } }`   | `'set' in item`       | Pushes string values to named output fields in the browser via WebSocket                                       |
| `{ vars: { name: anyValue } }`    | `'vars' in item`      | Persists any-typed values into `state.vars` for the next call — the only way to write device-local state       |
| `{ disconnect: true }`            | `'disconnect' in item`| Triggers `simulateDeviceDisconnection` on the app-side mock; bridge WS is closed immediately after             |
| `{ readError: { uuid: string } }` | `'readError' in item` | Triggers `simulateCharacteristicReadError` for the given UUID; error persists until cleared                    |
| `{ clearReadError: { uuid } }`    | `'clearReadError' in item` | Clears a previously set read error for the given UUID                                                     |

#### `utils` reference

All pack/unpack helpers use **little-endian** byte order (standard for Bluetooth SIG GATT specs).

| Function | Description |
|---|---|
| `toBase64(arr: Uint8Array)` | Encode a byte array to a base64 string |
| `fromBase64(b64: string)` | Decode a base64 string to a `Buffer` |
| `packUint8(n)` | 1-byte unsigned integer → base64 |
| `packInt8(n)` | 1-byte signed integer → base64 |
| `packUint16(n)` | 2-byte unsigned integer → base64 |
| `packInt16(n)` | 2-byte signed integer → base64 |
| `packUint32(n)` | 4-byte unsigned integer → base64 |
| `packFloat32(n)` | 4-byte IEEE 754 float → base64 |
| `unpackUint8(b64)` | base64 → 1-byte unsigned integer |
| `unpackInt8(b64)` | base64 → 1-byte signed integer |
| `unpackUint16(b64)` | base64 → 2-byte unsigned integer |
| `unpackInt16(b64)` | base64 → 2-byte signed integer |
| `unpackUint32(b64)` | base64 → 4-byte unsigned integer |
| `unpackFloat32(b64)` | base64 → 4-byte IEEE 754 float |

`in`/`out` definitions are typically returned from `start` events (and re-applied on file change). Error commands (`disconnect`, `readError`, `clearReadError`) are typically returned from `input` events — they are forwarded by the ble-bridge to the mock app via the WS channel (`bridgeMessages` in `ApplyResult`) and do not affect `state`.

> **Note:** `state` is read-only from the device code's perspective. Writing `state.hr = 42` inside the function will silently have no effect. Use `{ vars: { hr: 42 } }` instead.

### 6. Namespaces Model (`src/models/namespaces.ts`)

Each `POST /mount` call creates an isolated **Namespace** — a pairing of a `Store` and a chokidar `Watcher` for a given directory. Namespaces are identified by a UUID token.

- **`Namespaces`** class holds `Map<token, Namespace>`.
- `create(dir, label)` — starts a chokidar watcher on `dir`, creates a new `Store`, returns a `Namespace`.
- `destroy(token)` — closes the watcher, removes from the map.
- `get(token)` — returns the `Namespace` or `undefined`.
- `all()` — returns `NamespaceSummary[]` (token, label, dir — no store/watcher) for the index page.

`app.models.namespaces = new Namespaces()` is set synchronously in `src/index.ts` (no `onStart` needed).

`MojoModels` is augmented so `ctx.models.namespaces` is typed as `Namespaces`.

### 7. Store Model (`src/models/store.ts`)

Defines the shared types and the in-memory device registry. One `Store` instance exists per namespace.

- **`DeviceState`** — `{ dev, vars, chars, ui }` — the full runtime state for one device.
- **`DeviceEntry`** — `{ id, categoryDir, jsFilePath, state, events }` — one registered device. The `events` field is a Node.js `EventEmitter` used to signal `reload`, `input`, `set`, and `remove` to active bridge connections.
- **`UiControl`** — `{ name, label }` — one browser input or output control.
- **`Store`** — `Map<id, DeviceEntry>` with `add/get/set/remove/has/all` methods.
- **`sanitizeDeviceId(raw)`** — normalises a MAC string to lowercase with dashes.

### 8. State Engine (`src/state-engine.ts`)

Pure functions — no persistent state, not a model, not accessed via `ctx.models`.

- **`emptyDeviceState()`** — returns a blank `DeviceState` with all fields empty.
- **`initDeviceState(categoryDir)`** — reads `<categoryDir>/gatt-profile.json`, puts the full parsed object into `state.dev` (services included), and initialises `state.chars` with an empty string for every characteristic UUID.
- **`applyCommands(result, current)`** — iterates the array returned by `runDeviceLogic`, applies each command to a shallow copy of `current`, and returns `{ state, wsMessages, bridgeMessages }`. Never mutates `current`. Invalid or unrecognised items are silently skipped. `bridgeMessages` contains messages to be forwarded to the app over the ble-bridge WS (e.g. `{ type: "disconnect" }`).

### 9. GATT Labels & Default Device (`src/gatt-labels.ts`, `src/default-device.ts`)

- **`GATT_LABELS`** — `Record<string, string>` mapping ~120 standard GATT service and characteristic UUIDs to human-readable names. Covers Generic Access, Device Information, Heart Rate, Battery, Environmental Sensing, Blood Pressure, and more.
- **`DEFAULT_DEVICE_CODE`** — a static JavaScript string injected by the event processor when a device `.js` file is empty (zero bytes). At runtime it reads `state.dev.services` to wire characteristics automatically:
  - `read`/`notify` characteristics → `{ out: [{ name, label }] }`
  - `write` characteristics → `{ in: [{ name, label }] }`
  - Device name: `ESP32_` + last 5 hex chars of the MAC (from `state.dev.id`)
  - RSSI: −65 dBm
  - Labels resolved via `GATT_LABELS`; unknown UUIDs fall back to the raw UUID string.

### 10. File Watcher (`src/watcher.ts`)

Started per-namespace (in `Namespaces.create`) via `startWatcher(dir, store)` using **chokidar**:

- **Initial scan** (synchronous): walks `<dir>/<category>/` subdirectories that contain a `gatt-profile.json`. For each `<MAC>.js` file found, calls `addDevice` which reads the profile into `initDeviceState`, sets `state.dev.id`, and registers the entry in the store.
- **Live watching**: after startup, chokidar watches for:
  - `add` — new `.js` file → `addDevice`
  - `change` — existing `.js` modified → resets `entry.state` to `initDeviceState`, re-runs the `start` event (applying all commands including chars, vars, ui, and dev patches), then emits internal `"reload"` on `entry.events` so any active bridge pushes the refreshed chars to the app
  - `unlink` — `.js` deleted → emits `"remove"` on `entry.events`, then removes from store

Device IDs must match the pattern `[0-9a-f]{2}(-[0-9a-f]{2}){5}` (MAC address with dashes). Files not matching this pattern are ignored.

### 11. `GET /ns/:token/devices` (`src/controllers/devices.ts`)

Reads the namespace from the stash. For each entry in the namespace's store, runs `runDeviceLogic` with `{ kind: "advertise" }` and applies the result via `applyCommands`. The resulting `state.dev` is the advertising packet. A default `rssi: -65` is injected if the device logic does not set one. Returns the array of dev objects as JSON.

This endpoint is polled by the app-side mock (`ble-faker/mock`) on scan start and every 5 seconds while scanning.

The result of `applyCommands` is written back to `entry.state`, so `{ vars: … }` and `{ name, rssi, … }` commands returned from `advertise` are persisted and available on the next call.

### 12. BLE Bridge (`src/controllers/ble-bridge.ts`)

`WebSocket /ns/:token/bridge/:id` — opened by the app-side mock immediately after `connectToDevice` succeeds.

On each new connection:

1. **Char push** — all current `entry.state.chars` values (set by the watcher's `start` run) are sent to the app immediately as `{ type: "char", uuid, value }` (non-empty values only).
2. **`connect`** event fires — device logic can perform per-connection setup. Diffs from the result are sent to the app.
3. **Tick timer** fires every 1 second — drives `tick` events; diffs are forwarded to the app.
4. **File change** (internal `"reload"` on `entry.events`) — the watcher has already re-run `start` and updated `entry.state`. The bridge pushes all current chars to the app and emits the updated UI.
5. **`input`** event — wired to `entry.events`; fires when the browser UI submits a form field or when the test HTTP endpoint injects an input (see §17).
6. **Incoming messages** (app → server): `{ uuid, payload }` objects are forwarded as `notify` events. The result is applied and diffs are sent back to the app.

After processing each event, any `bridgeMessages` from `applyCommands` are sent to the app over the WS. If a `{ type: "disconnect" }` message is among them, the bridge WS is closed server-side immediately after sending it.

On WebSocket close: tick timer and event listeners are removed, then the **`disconnect`** event fires — device logic can persist session cleanup via `{ vars: … }` for the next connection.

The server sends characteristic updates **only for changed values** (diff against `entry.state.chars`), then writes the new state back to `entry.state`.

### 13. Browser Dashboard (`src/controllers/namespaces.ts`, `views/`)

`GET /ns/:token` — renders a live HTML dashboard for the namespace.

- **`namespaces#show`** reads all devices from the namespace store, generates a per-device absolute WebSocket URL (via `ctx.urlFor('connect_browser_bridge', { absolute: true })`), and renders `views/namespaces/show.html.tmpl`.
- The page lists each device by name and MAC address. On load, client-side JavaScript opens a WebSocket to `GET /ns/:token/browser/:id` for each device and renders its `in`/`out` controls when the first `ui` message arrives.
- A green status dot shows whether each device's WebSocket is live.
- Page-specific styles are injected into `<head>` via a `<{headBlock}>` content block; the initialisation script runs at the bottom of `<body>` so DOM elements are available.
- `views/layouts/default.html.tmpl` provides shared HTML boilerplate (title, base styles) for both this and the root index view.

#### Browser Bridge (`src/controllers/browser-bridge.ts`)

`WebSocket /ns/:token/browser/:id` — opened by the dashboard for a specific device.

- On connect: emits the current UI definition to the browser as `{ type: "ui", ui }`.
- Subscribes to `set` events on `entry.events` and forwards them to the browser as `{ type: "set", fieldName, value }` real-time output field updates.
- Receives `{ type: "input", id, payload }` from the browser and fires `input` events on `entry.events`.

### 14. App-Side Mock (`src/mock.ts`, `ble-faker/mock`)

Exposed as the `./mock` package subpath (`dist/mock.js`). Acts as a drop-in replacement for `react-native-ble-plx` via Metro's module resolution hook.

`react-native-ble-plx-mock` is **bundled into** `dist/mock.js` (not an external dependency). `react-native` is externalized and resolved from the app's own package at bundle time.

#### Metro configuration (app side)

```js
// metro.config.js
const bleMock = process.env.BLE_MOCK === "true";
if (bleMock) {
  // ── Configuration ──────────────────────────────────────────────────
  const stateFile = path.join(os.homedir(), ".ble-faker-server.json");
  const { port: bleFakerPort } = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  const BLE_FAKER_DIR = path.join(__dirname, "mocks"); // parent of category dirs
  const BLE_FAKER_LABEL = "My App";
  // ───────────────────────────────────────────────────────────────────

  const bleFakerDir = fs.realpathSync(
    path.join(__dirname, "node_modules/ble-faker"),
  );
  const mockPath = path.join(bleFakerDir, "dist/mock.js");

  config.watchFolders = [bleFakerDir];

  // Serve config to the RN bundle via Metro's own HTTP server
  config.server = {
    ...config.server,
    enhanceMiddleware: (middleware) => (req, res, next) => {
      if (req.url === "/ble-faker-config") {
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            port: bleFakerPort,
            dir: BLE_FAKER_DIR,
            label: BLE_FAKER_LABEL,
          }),
        );
        return;
      }
      middleware(req, res, next);
    },
  };

  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === "react-native-ble-plx") {
      return { filePath: mockPath, type: "sourceFile" };
    }
    // bare imports from ble-faker must resolve from the app's node_modules
    if (
      context.originModulePath.startsWith(bleFakerDir) &&
      !moduleName.startsWith(".")
    ) {
      return context.resolveRequest(
        { ...context, originModulePath: path.join(__dirname, "package.json") },
        moduleName,
        platform,
      );
    }
    return context.resolveRequest(context, moduleName, platform);
  };
}
```

Key points:

- `resolveRequest` is used (not `extraNodeModules`) — Metro requires file-level remapping for specific file targets.
- `fs.realpathSync` is required because `node_modules/ble-faker` may be a symlink; Metro needs the real path in `watchFolders`.
- **Port is auto-detected** from the running server's state file — no hardcoding needed.
- The `enhanceMiddleware` route serves configuration to the RN bundle; it is set up at Metro startup, so **Metro must be restarted** (not just reloaded) when metro.config.js changes.
- `BLE_FAKER_DIR` must point to the **parent** of category directories (the watcher scans one level down for subdirs containing `gatt-profile.json`).

#### `BleManager` subclass

Re-exports the full surface of `react-native-ble-plx-mock` and replaces `BleManager` with a subclass. The constructor takes no arguments — all configuration is fetched lazily on first scan start:

```ts
export class BleManager extends MockManager {
  constructor() {
    super();
    this.onStartScan(() => {
      void this._mount().then(() => {
        /* poll */
      });
    });
    this.onStopScan(() => {
      /* clear interval */
    });
  }
}
```

#### Mount flow

On first `onStartScan`:

1. Detect the Metro server origin via `_metroOrigin()`, which tries in order:
   - `NativeModules.SourceCode.scriptURL` — available in standard React Native (e.g. `http://192.168.1.100:8081/index.bundle?…`).
   - `expo-constants` (`Constants.expoConfig?.hostUri` or `Constants.manifest?.debuggerHost`) — used in Expo managed workflow where `NativeModules.SourceCode` is unavailable.
   - Falls back to `http://localhost:8081` (works on simulators/emulators where localhost resolves to the dev machine).
2. `GET <metroOrigin>/ble-faker-config` — receives `{ port, dir, label }`.
3. Construct `serverBase = http://<host>:<port>` using the same host as Metro (ble-faker runs on the same machine).
4. `POST <serverBase>/mount { dir, label }` — creates a namespace; receives `{ devicesUrl, bridgeUrl }`.

`_mountPromise` caches the result — repeated scan start/stop cycles reuse the same namespace. If the mount fails, `_mountPromise` is reset to `null` so the next scan start retries automatically. Errors are surfaced via `console.error("[ble-faker] mount failed: …")`.

#### Polling loop (scanning)

1. `GET devicesUrl` — if unreachable, treat as empty list.
2. `clearMockDevices()` unconditionally.
3. `addMockDevice(d)` for each device with a valid `id` string. Also builds a `charUUID → serviceUUID` lookup map for the WS bridge.

An `inProgress` flag prevents overlapping polls.

#### WebSocket bridge (per connected device)

Opened immediately after `connectToDevice` succeeds (`/ns/:token/bridge/:id`), closed on `cancelDeviceConnection`.

- **App → server** (`writeCharacteristicWith[out]ResponseForDevice`): forwards `{ uuid, payload }` over the WS. A write queue buffers messages sent while the WS is still in the `CONNECTING` state; they are flushed on `open`.
- **Server → app** (`onmessage`): dispatches incoming messages by `type`:
  - `"char"` — calls `setCharacteristicValue(deviceId, serviceUUID, uuid, value)`, triggering any registered monitors.
  - `"disconnect"` — calls `simulateDeviceDisconnection(deviceId)`, firing the app's connection-loss callback.
  - `"readError"` — calls `simulateCharacteristicReadError(deviceId, serviceUUID, charUUID, error)`. The error persists for all subsequent reads until cleared.
  - `"clearReadError"` — calls `clearCharacteristicReadError(deviceId, serviceUUID, charUUID)`.
  - `serviceUUID` is resolved from the `charUUID → serviceUUID` lookup map built during polling.
- **Reconnect safety**: `_openBridge` always calls `_closeBridge` first to prevent stale WS instances. The `onclose` handler guards with an identity check (`ws === current`) so a closing stale socket cannot clobber a newer one.

### 15. Tests

78 tests across 10 files, run in parallel via `node --test test/**/*.test.ts`:

| file                            | what it covers                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `test/advertising-size.test.ts` | `calculateAdvertizingSize` helper (packet size arithmetic) — 5 tests                                                                       |
| `test/bridges.test.ts`          | `ble-bridge` and `browser-bridge` WebSocket controllers — 6 tests                                                                          |
| `test/default-device.test.ts`   | `DEFAULT_DEVICE_CODE` via `runDeviceLogic` — 7 tests covering start/input/unknown events and edge cases                                    |
| `test/device-logic.test.ts`     | `runDeviceLogic` sandbox — 21 tests covering core behaviour, utils, console capture, state isolation, error handling, and sandbox security |
| `test/devices.test.ts`          | `GET /ns/:token/devices` endpoint — 6 tests                                                                                                |
| `test/namespaces.test.ts`       | `POST /mount` and `DELETE /ns/:token` — 4 tests                                                                                            |
| `test/root.test.ts`             | `GET /` namespace index page — 3 tests                                                                                                     |
| `test/server.test.ts`           | server lifecycle — spawns a real server, verifies state file round-trip and `stop` subcommand — 2 tests                                    |
| `test/state-engine.test.ts`     | `applyCommands` (13 tests) and `initDeviceState` (1 test)                                                                                  |
| `test/test-bridge.test.ts`      | `POST`/`GET` test-bridge endpoints and devices URL fields — 7 tests                                                                        |

`test/fixtures/heart-rate-monitors/` contains the shared device fixture used across multiple suites.

### 16. CI

Three-platform matrix (ubuntu, macos, windows) via `.github/workflows/ci.yml`, running `pnpm build:test` on Node 23. Automatic release PR management via `release-please`. Typical run times: Ubuntu fastest, macOS ~26s, Windows ~46s (Windows overhead is inherent — NTFS + Defender — not test execution time).

### 17. Test Control HTTP API (`src/controllers/test-bridge.ts`)

Two HTTP endpoints that complement the WebSocket channels with a stateless, scriptable interface for automated tests (Detox, node:test, etc.).

#### `POST /ns/:token/test/:id`

Injects an `input` event into the device identified by `:id` (MAC address). Request body: `{ name: string, payload: string }`, where `name` matches an entry from the device's `in` definitions and `payload` is the string value to submit.

Internally this fires the same `input` event on `entry.events` that the browser-bridge fires on WS form submit. If a ble-bridge WebSocket is connected, device logic runs immediately and any characteristic diffs are pushed to the app. Returns `204 No Content` on success, `404` if the namespace or device is not found.

#### `GET /ns/:token/test/:id?name=<field>&expected=<pattern>&timeout=<ms>`

Long-polls until the device emits a `{ set: { <name>: value } }` output where `value` matches `expected` (a regex pattern, URL-encoded), or until `timeout` milliseconds elapse (default: 5000).

The handler subscribes to `set` events on `entry.events` for the duration of the request — no polling, purely push-triggered. Returns `{ name, value }` on match, `408 Request Timeout` if the timeout expires without a match.

> **Important:** the GET must be issued _before_ the action that triggers the output, since events that fire while no subscriber is waiting are silently missed (no buffering).

#### Shared input handler

Both the browser-bridge WS handler and the POST endpoint call the same internal `handleInput(entry, name, payload)` helper so input-handling logic is not duplicated across transports.

#### Discoverability

`GET /ns/:token/devices` includes a per-device `testUrl` field (absolute HTTP URL: `http://host/ns/TOKEN/test/DEVICE_ID`) alongside the existing advertising fields. It also includes a per-device `bridgeUrl` (fully resolved, no `:id` placeholder), making this endpoint the canonical source of per-device URLs. Test code never constructs URLs by hand — that is handled by `BleTestClient` (see §18).

---

### 18. `ble-faker/test` — Test Client (`src/test-client.ts`)

A `ble-faker/test` subpath export that gives test code a clean, URL-free API for controlling mock devices. Designed for use in Detox E2E tests and any Node.js test runner.

#### `BleTestClient`

```ts
import { BleTestClient } from "ble-faker/test";
```

- **`BleTestClient.connect()`** — reads the state file (respecting `BLE_FAKER_STATE`) to locate the running server. Returns a `BleTestClient` instance.
- **`client.mount({ dir, label })`** — calls `POST /mount`, then `GET /devices` to discover per-device URLs. Returns a `BleNamespace`.
- **`client.unmount(ns)`** — calls `DELETE /ns/:token` and disposes the namespace.

#### `BleNamespace`

- **`ns.device(id)`** — returns a `BleDevice` handle for the device with the given MAC address. The `testUrl` is resolved from the devices response; the developer never constructs URLs manually. Throws if the device is not found in the namespace.
- **`ns.refresh()`** — re-fetches `GET /devices` to pick up newly added devices.

#### `BleDevice`

- **`device.input(name, payload)`** — `POST testUrl` with `{ name, payload }`. Triggers an `input` event in the device logic.
- **`device.waitForOutput(name, expected, timeout?)`** — long-poll `GET testUrl?name=…&expected=…&timeout=…`. Resolves with the matched string value; rejects on timeout (default 5 s).

#### Developer experience

The only identifier a developer needs to know is the device MAC address — which they already know, because it is the filename of the device's `.js` logic file:

```ts
// test/heart-rate.test.ts
import { BleTestClient } from "ble-faker/test";

const client = await BleTestClient.connect();
const ns = await client.mount({ dir: "./mocks", label: "e2e" });
const device = ns.device("aa-bb-cc-dd-ee-ff");

// Subscribe to output BEFORE triggering the input that produces it.
const outputPromise = device.waitForOutput("current", /^1[0-9]{2}$/, 3000);
await device.input("target", "120");

assert.match(await outputPromise, /^1[0-9]{2}$/);

await client.unmount(ns);
```

All URL construction, state file reading, and HTTP mechanics are internal to `BleTestClient`. If server URL structure changes, only the client implementation changes — test files are unaffected.

---

### 19. `ble-faker/device` — Device Types Subpath (`src/device.ts`)

A types-only package subpath (no runtime code, `dist/device.d.ts` only) that enables IDE autocompletion and inline documentation in device `.js` logic files. `// @ts-check` is intentionally **omitted** from the recommended header — React Native projects do not enable `checkJs`, so adding it triggers `noImplicitAny` errors on untyped helper function parameters. The `/// <reference>` directive and `@type` annotation alone give full autocompletion and event/state narrowing.

#### Usage

Add a two-line header to any device file:

```js
/// <reference types="ble-faker/device" />

/** @type {import('ble-faker/device').DeviceLogicFn} */
export default function (state, event) {
  // event.kind autocompletes to 'start' | 'connect' | 'disconnect' | 'tick' | 'advertise' | 'notify' | 'input'
  // utils.packUint16, utils.unpackFloat32, etc. all autocomplete with inline docs
  return [];
}
```

#### Exported types

| Type | Description |
|---|---|
| `DeviceLogicFn` | The function signature: `(state, event) => DeviceCommand[] \| void` |
| `DeviceState` | `{ dev, vars, chars, ui }` — the read-only state argument |
| `DeviceEvent` | Discriminated union of all event kinds |
| `DeviceCommand` | Union of all valid return items |
| `DeviceUtils` | The `utils` global object shape |
| `UiControl` | `{ name, label }` — one browser input or output field |

Individual event types (`StartEvent`, `ConnectEvent`, `DisconnectEvent`, `TickEvent`, `AdvertiseEvent`, `NotifyEvent`, `InputEvent`) and command types (`CharCommand`, `DisconnectCommand`, `ReadErrorCommand`, etc.) are also exported for narrowing.

#### Global declarations

`utils` is declared as a `var` in the global scope so VS Code recognises it without an import. `Buffer`, `TextEncoder`, and `TextDecoder` are standard globals that editors already know about.

---

## Planned

### `ble-faker/metro` helper

A CJS module (`dist/metro.js`) that packages the full metro.config.js integration into a single `withBleFaker(config, { dir, label })` call — reads the state file, adds `enhanceMiddleware`, configures `resolveRequest` and `watchFolders`. Reduces app-side boilerplate to two lines.

### Heartbeat

The server will touch the state file's mtime every ~5 seconds (`setInterval`, `.unref()`'d) as a liveness signal. On next startup, mtime age provides a secondary stale-file check that survives PID reuse.
