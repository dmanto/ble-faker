# Project: ble-faker

`ble-faker` is a scriptable BLE (Bluetooth Low Energy) simulation toolchain built on the `@mojojs/core` framework. It enables developers to simulate complex hardware peripherals using JavaScript logic and interact with them from React Native apps without physical hardware.

## Core Architecture

The system consists of a **Mojo.js Server** (the simulation engine) and a **Client Bridge** (integrating with the mobile app).

---

## Implemented

### 1. The Simulation Engine (Mojo.js)

The server is a `@mojojs/core` application started via `npx ble-faker --dir <path> --port <port>` (see `src/bin.ts`). Currently it exposes one route:

- `GET /` — returns `{ version, dir }` as JSON.

The server includes two mojo helpers registered in `src/plugins.ts`:

- **`calculateAdvertizingSize`** — computes the byte length of an advertising packet and validates it against the 31-byte legacy BLE limit.
- **`runDeviceLogic`** — sandboxed execution engine for device `.js` logic files (see below).

### 2. CLI Entry Point

`src/bin.ts` is a thin CLI argument parser — it imports `app` from `index.ts` (which registers all hooks and routes as a side effect) then delegates to mojo's `server` command via `app.cli.start()`. This bypasses mojo's `detectImport` guard, which breaks under symlinks such as `npx` and `pnpm link`.

`bin.ts` also registers process exit handlers to clean up the state file on unexpected termination:

- **`process.on('exit', …)`** — fires synchronously on `process.exit()` and unhandled exceptions (crashes).
- **`process.on('SIGINT', …)`** — fires on Ctrl+C.
- **SIGTERM** is already handled by mojo's `onStop` hook (see §3).
- **SIGKILL** cannot be intercepted by any process — the PID liveness check on next startup covers that case.

### 3. Server State File

`src/index.ts` registers two mojo lifecycle hooks on the shared `app` object:

- **`onStart`** — writes `~/.ble-faker-server.json` containing `{ pid, url, port }` once the server is ready.
- **`onStop`** — deletes the state file on graceful SIGTERM shutdown.

Together with the `bin.ts` exit handlers above, the state file is cleaned up for all termination scenarios except SIGKILL. Stale files from SIGKILL or hard crashes are detected on next startup via a PID liveness check (`process.kill(pid, 0)`).

### 4. `bleMockServer` Helper (`src/server-control.ts`)

A programmatic interface for use in tests and app-side mock code:

- `start({ dir, port })` — spawns the server by invoking `process.execPath` (the current Node binary) directly with `dist/bin.js`, then polls `GET /` until it responds (30s timeout). The bin path is resolved at runtime via `path.dirname(fileURLToPath(import.meta.url))` — **not** via `new URL("./bin.js", import.meta.url)`, which Vite would inline as a `data:` URL during the library build.
- `stop()` — kills the server process. On Windows uses `taskkill /F /T` to terminate the full process tree; on Linux/macOS kills the process group via `process.kill(-pid)`.
- `get()` — reads the state file to obtain the server URL, performs `GET /`, returns the parsed JSON body.

Exported from `src/index.ts` so it is available as `import { bleMockServer } from 'ble-faker'`.

### 5. Device Logic Sandbox (`runDeviceLogic`)

Device `.js` files export a single default function. A complete example showing all event kinds:

```js
export default function(state, event) {

  if (event.kind === 'start') {
    return [
      { in:  [{ name: 'target', label: 'Target HR' }] },
      { out: [{ name: 'current', label: 'Current HR' }] },
    ];
  }

  if (event.kind === 'advertise') {
    return [{ name: 'HR Monitor', rssi: -65, serviceUUIDs: ['180D'] }];
  }

  if (event.kind === 'tick') {
    const hr = state.vars?.hr ?? 72;
    return [
      ['2A37', utils.packUint16(hr)],
      { set: { current: String(hr) } },
    ];
  }

  if (event.kind === 'input' && event.id === 'target') {
    return [{ vars: { hr: parseInt(event.payload, 10) } }];
  }

  return [];
}
```

`runDeviceLogic` executes this safely via `node:vm`:

- **Isolation**: runs in a `vm.createContext` sandbox. `process` and `require` are explicitly shadowed as `undefined` in the sandbox object to prevent prototype-chain leakage from the Node.js host context.
- **ESM compatibility**: strips `export default` before evaluation so `vm.Script` (CommonJS) can handle it.
- **Timeout**: configurable CPU limit (default 50ms) prevents runaway logic.
- **Available globals** (no imports needed): `Buffer`, `Uint8Array`, `DataView`, and a `utils` object with `toBase64`, `fromBase64`, `packUint16`.
- **`state`**: read-only input from the server. Contains two server-managed namespaces:
  - `state.dev` — current accumulated `Partial<Device>` (advertising packet fields).
  - `state.vars` — device-local values persisted from previous `{ vars: … }` return instructions (see below).
  - Direct mutations to `state` inside the function are **silently discarded** — all writes must go through return instructions.
- **Result normalisation**: the return value is JSON round-tripped before leaving the helper, converting vm-context arrays/objects into host objects. This makes results safe to serialise and comparable with `deepEqual`.
- **Console capture**: `console.log/warn/error` inside logic files are captured into a `logs` array rather than written to stdout. Returns `DeviceLogicOutput { result, logs }` — logs will be forwarded to the browser device view via WebSocket (planned).

#### Event system

The `event` argument is a typed discriminated union (`DeviceEvent`):

| kind        | description                                                        |
| ----------- | ------------------------------------------------------------------ |
| `start`     | server/device initialization                                       |
| `tick`      | periodic timer update                                              |
| `reload`    | mock file changed on disk                                          |
| `advertise` | server requests the current advertising packet                     |
| `notify`    | characteristic notification triggered — `uuid` + `payload` (base64) |
| `input`     | browser submitted a form field — `id` + `payload`                 |

#### Return format — command dispatch

Each item in the returned array is one of the following. The server discriminates by shape:

| Item shape | Discriminant | Effect |
| --- | --- | --- |
| `['2A37', base64]` | `Array.isArray` | Updates a GATT characteristic value |
| `{ name, rssi, … }` | plain object | Patches `state.dev` (advertising packet — any `Partial<Device>` field) |
| `{ in: [{ name, label }] }` | `'in' in item` | Defines browser input controls: one label + text field + submit button per entry; submit POSTs → `input` event |
| `{ out: [{ name, label }] }` | `'out' in item` | Defines browser output display fields: one label + empty field per entry, `id` taken from `name` |
| `{ set: { fieldName: 'val' } }` | `'set' in item` | Pushes string values to named output fields in the browser via WebSocket |
| `{ vars: { name: anyValue } }` | `'vars' in item` | Persists any-typed values into `state.vars` for the next call — the only way to write device-local state |

`in`/`out` definitions are typically returned from `start` and `reload` events. The server applies all commands internally using JSON pointers — device code never constructs paths directly.

> **Note:** `state` is read-only from the device code's perspective. Writing `state.hr = 42` inside the function will silently have no effect. Use `{ vars: { hr: 42 } }` instead.

### 6. Tests

Three test files, run in parallel via `node --test test/**/*.test.ts`:

| file | what it covers |
|---|---|
| `test/advertising-size.test.ts` | `calculateAdvertizingSize` helper (packet size arithmetic) |
| `test/device-logic.test.ts` | `runDeviceLogic` sandbox — 14 tests covering core behaviour, utils, console capture, state isolation, error handling, and sandbox security |
| `test/server.test.ts` | `bleMockServer` lifecycle — spawns a real server, verifies state file round-trip, stops it |

`test/fixtures/heart-rate-monitors/gatt-profile.json` holds the first example device fixture (work in progress).

### 7. CI

Three-platform matrix (ubuntu, macos, windows) via `.github/workflows/ci.yml`, running `pnpm build:test` on Node 23. Automatic release PR management via `release-please`. Typical run times: Ubuntu fastest, macOS ~26s, Windows ~46s (Windows overhead is inherent — NTFS + Defender — not test execution time).

---

## Planned

### Device Discovery (Polling)

Instead of a persistent WebSocket, the app-side mock will poll `GET /devices` on a configurable interval (default 5 seconds):

1. Derive the server URL from the Expo dev server host + the configured ble-faker port.
2. `GET /devices` — returns the list of currently advertising devices, each entry pre-formatted as `addMockDevice()` arguments.
3. Call `clearMockDevice()` unconditionally (even if the GET failed or the server is unreachable).
4. Call `addMockDevice()` for each device in the response.

An `inProgress` guard prevents overlapping polls on slow networks.

### Heartbeat

The server will touch the state file's mtime every ~5 seconds (`setInterval`, `.unref()`'d) as a liveness signal. On next startup, mtime age provides a secondary stale-file check that survives PID reuse.

### Per-Device Routes (WebSocket)

Once a device is discovered and connected, WebSocket routes will handle the ongoing simulation:

- **`bridge-device/<id>`**: GATT structure and initialization for a specific device connection.
- **`index-refresh`**: Signals the browser/dashboard to reload when the mock folder structure changes.
- **`device/<id>`**: Real-time simulation stream.
  - **Downlink (Server → App)**: Pushes state changes from the `.js` script via `setCharacteristicValue()`.
  - **Uplink (App → Server)**: Captures app writes via `onCharacteristicWrite` and pushes them back to the logic engine.

### Mock Device Logic (file conventions)

The sandbox engine is implemented (see §5). The `test/fixtures/` directory contains the first example of the intended folder structure. Still needed:

- `gatt-profile.json` file format specification and loader.
- `<id>.js` file watcher (chokidar, already a dependency) triggering `reload` events.
- **State Engine**: JSONPath-based instructions to apply the `result` commands returned by `runDeviceLogic`.

### App-Side Integration (`ble-faker/mock`)

The package will expose a `./mock` subpath export (`dist/mock.js`) that acts as a drop-in replacement for `react-native-ble-plx` via Metro's module remapping:

```js
// metro.config.js
const isMockMode = process.env.BLE_MOCK === "true";
module.exports = {
  resolver: {
    extraNodeModules: isMockMode
      ? {
          "react-native-ble-plx": require.resolve("ble-faker/mock"),
        }
      : {},
  },
};
```

The app imports `react-native-ble-plx` normally — no code changes needed to enable mock mode.

#### Implementation

`ble-faker/mock` re-exports the full surface of `react-native-ble-plx-mock` and replaces `BleManager` with a subclass that wires the polling loop into the scan lifecycle:

```ts
import { BleManager as MockManager } from "react-native-ble-plx-mock";

export class BleManager extends MockManager {
  constructor() {
    super();
    this.onStartScan(() => startPolling(this));
    this.onStopScan(() => stopPolling());
  }
}
export * from "react-native-ble-plx-mock"; // re-export Device, Characteristic, etc.
```

`react-native-ble-plx-mock` (owned by dmanto) already exposes `onStartScan`/`onStopScan` hooks and `addMockDevice()`/`clearMockedDevices()` as instance methods — no changes to that library needed.

#### Polling loop (inside `ble-faker/mock`)

Runs in the React Native app, uses only `fetch` and `expo-constants` (no Node.js built-ins):

1. Derive server URL from `Constants.expoConfig.hostUri` (Expo dev server host) + configured ble-faker port.
2. `GET /devices` — if unreachable, treat as empty list.
3. `manager.clearMockedDevices()` unconditionally.
4. `manager.addMockDevice(d)` for each device returned.

An `inProgress` flag prevents overlapping polls. Interval is configurable (default 5s).

#### Constraints

- Expo / Metro only — URL derivation relies on `expo-constants`.
- Dev builds only — `hostUri` is not available in production bundles.
- `react-native-ble-plx-mock` must be listed as a `peerDependency`.
