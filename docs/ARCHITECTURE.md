# Project: ble-faker

`ble-faker` is a scriptable BLE (Bluetooth Low Energy) simulation toolchain built on the `@mojojs/core` framework. It enables developers to simulate complex hardware peripherals using JavaScript logic and interact with them from React Native apps without physical hardware.

## Core Architecture

The system consists of a **Mojo.js Server** (the simulation engine) and a **Client Bridge** (integrating with the mobile app).

### 1. The Simulation Engine (Mojo.js)

The server manages a directory of mock devices. Each device is defined by:

- `gatt-profile.json`: Defines the GATT tree (Services and Characteristics).
- `id.js`: A scriptable logic file that manages device state and responds to events.
- **State Engine**: Uses JSONPath-based instructions to push updates and includes a validator to ensure Advertising packets stay within the BLE 31-byte legacy limit.

### 2. The Bridge Protocol

The communication between the mobile app and the server uses a mixed approach: polling for device discovery and WebSockets for per-device real-time simulation.

#### Device Discovery (Polling)

Instead of a persistent WebSocket, the app-side mock polls the server on a configurable interval (default 5 seconds):

1. Derive the server URL from the Expo dev server host + the configured ble-faker port.
2. `GET /devices` — returns the list of currently advertising devices, each entry pre-formatted as `addMockedDevice()` arguments.
3. Call `clearMockedDevices()` unconditionally (even if the GET failed or the server is unreachable).
4. Call `addMockedDevice()` for each device in the response.

This ensures the app's scanned device list always converges to the server's current state. If the server is down, the result is an empty scan — no stale devices accumulate. An `inProgress` guard prevents overlapping polls on slow networks.

#### Per-Device Routes (WebSocket)

Once a device is discovered and connected, three WebSocket routes handle the ongoing simulation:

- **`bridge-device/<id>`**: A dedicated pipe for a specific device connection, handling the GATT structure and initialization logic.
- **`index-refresh`**: A developer-experience route that signals the browser/dashboard to reload when the mock folder structure changes.
- **`device/<id>`**: The real-time simulation stream.
  - **Downlink (Server -> App)**: Pushes state changes from the `.js` script to the app-side bridge via `setCharacteristicValue()`.
  - **Uplink (App -> Server)**: Captures app writes via the `onCharacteristicWrite` hook in the mock library and pushes them back to the Mojo logic engine.

### 3. Server State File

On startup the server writes a state file (e.g. `~/.ble-faker-server.json`) containing `{ port, url, pid }` using mojo's `onStart` hook. The file is deleted on graceful shutdown via `onStop`. A heartbeat (`setInterval`, ~5s, `.unref()`'d) touches the file's mtime while the server is running.

On next startup, if a state file is found, the server checks the mtime age to detect stale files from crashed or killed processes, and the PID for immediate liveness confirmation.

### 4. App-Side Integration

The project leverages `react-native-ble-plx-mock` on the React Native side. This allows the application to use the standard `BleManager` API while the bridge code handles the background synchronization with the Mojo server. The app remains unaware it is talking to a simulation.

## Key Features

- **CLI Driven**: Run via `npx ble-faker -d ./mocks -p 58083`.
- **Hot Reloading**: Changes to mock `.js` files or GATT profiles are reflected in real-time.
- **Decoupled Logic**: Simulation logic lives in Node.js, keeping the mobile bundle lean.
- **Bidirectional**: Supports both notifications/reads (Server-to-App) and writes (App-to-Server).
