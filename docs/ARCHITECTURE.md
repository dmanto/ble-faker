# Project: ble-faker

`ble-faker` is a scriptable BLE (Bluetooth Low Energy) simulation toolchain built on the `@mojojs/core` framework. It enables developers to simulate complex hardware peripherals using JavaScript logic and interact with them from React Native apps without physical hardware.

## Core Architecture

The system consists of a **Mojo.js Server** (the simulation engine) and a **Client Bridge** (integrating with the mobile app).

---

## Implemented

### 1. The Simulation Engine (Mojo.js)

The server is a `@mojojs/core` application started via `npx ble-faker --dir <path> --port <port>` (see `src/bin.ts`). Currently it exposes one route:

- `GET /` — returns `{ version, dir }` as JSON.

The server includes a BLE advertising size validator (`calculateAdvertizingSize` in `src/plugins.ts`) that computes the byte length of an advertising packet and validates it against the 31-byte legacy BLE limit.

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

### 5. CI

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

### Mock Device Logic

Each device will be defined by:

- `gatt-profile.json`: GATT tree (Services and Characteristics).
- `<id>.js`: Scriptable logic file managing device state and responding to events (`start`, `tick`, `notify`). Runs in a `node:vm` isolated context — no access to `process`, filesystem, or network.
- **State Engine**: JSONPath-based instructions to push updates.

### App-Side Integration

The project will integrate with `react-native-ble-plx-mock` on the React Native side, allowing the application to use the standard `BleManager` API while the bridge handles synchronization with the Mojo server transparently.
