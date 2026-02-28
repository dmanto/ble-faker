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

`src/bin.ts` parses `--dir`/`-d` and `--port`/`-p` flags and delegates to mojo's `server` command via `app.cli.start()` (bypassing mojo's `detectImport` guard, which breaks under symlinks such as `npx` and `pnpm link`).

### 3. Server State File

On startup the server writes `~/.ble-faker-server.json` containing `{ pid, url, port }` via mojo's `onStart` hook. The file is deleted on graceful shutdown via `onStop`. If the server crashes or is killed, the file remains stale and is detected on next startup via a PID liveness check (`process.kill(pid, 0)`).

### 4. `bleMockServer` Helper (`src/server-control.ts`)

A programmatic interface for use in tests and app-side mock code:

- `start({ dir, port })` — spawns the server via `npx`, polls `GET /` until it responds (10s timeout).
- `stop()` — kills the server process. On Windows uses `taskkill /F /T` to terminate the full process tree; on Linux/macOS kills the process group via `process.kill(-pid)`.
- `get()` — reads the state file to obtain the server URL, performs `GET /`, returns the parsed JSON body.

Exported from `src/index.ts` so it is available as `import { bleMockServer } from 'ble-faker'`.

### 5. Device Logic Sandbox (`runDeviceLogic`)

Device `.js` files export a single default function:

```js
export default function (state, event) {
  if (event.kind === "tick") {
    return [["2A37", utils.packUint16(72)]];
  }
  return [];
}
```

`runDeviceLogic` executes this safely via `node:vm`:

- **Isolation**: runs in a `vm.createContext` sandbox with no access to `process`, filesystem, or network.
- **ESM compatibility**: strips `export default` before evaluation so `vm.Script` (CommonJS) can handle it.
- **Timeout**: 50ms CPU limit prevents runaway logic.
- **Available globals** (no imports needed): `Buffer`, `Uint8Array`, `DataView`, and a `utils` object with `toBase64`, `fromBase64`, `packUint16`.
- **Console capture**: `console.log/warn/error` inside logic files are captured into a `logs` array rather than written to stdout. Returns `DeviceLogicOutput { result, logs }` — logs will be forwarded to the browser device view via WebSocket (planned).
- **Event system**: the `event` argument is a typed discriminated union (`DeviceEvent`) covering all lifecycle and interaction events:

| kind        | description                                    |
| ----------- | ---------------------------------------------- |
| `start`     | server/device initialization                   |
| `tick`      | periodic timer update                          |
| `reload`    | mock file changed on disk                      |
| `advertise` | server requests advertising packet data        |
| `describe`  | server requests UI schema for browser view     |
| `notify`    | characteristic notification triggered (`uuid`) |
| `input`     | browser POSTed an action (`id`, `payload`)     |

### 6. CI

Three-platform matrix (ubuntu, macos, windows) via `.github/workflows/ci.yml`, running `pnpm build:test` on Node 23. Automatic release PR management via `release-please`.

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

The sandbox engine is implemented (see §5). Still needed:

- `gatt-profile.json` file format and loader.
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
