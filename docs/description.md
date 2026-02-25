# Project: ble-faker

`ble-faker` is a scriptable BLE (Bluetooth Low Energy) simulation toolchain built on the `@mojojs/core` framework. It enables developers to simulate complex hardware peripherals using JavaScript logic and interact with them from React Native apps without physical hardware.

## Core Architecture

The system consists of a **Mojo.js Server** (the simulation engine) and a **Client Bridge** (integrating with the mobile app).

### 1. The Simulation Engine (Mojo.js)

The server manages a directory of mock devices. Each device is defined by:

- `gatt-profile.json`: Defines the GATT tree (Services and Characteristics).
- `id.js`: A scriptable logic file that manages device state and responds to events.
- **State Engine**: Uses JSONPath-based instructions to push updates and includes a validator to ensure Advertising packets stay within the BLE 31-byte legacy limit.

### 2. The WebSocket Bridge (4-Route Protocol)

The communication between the mobile app and the server is orchestrated through four specific WebSocket routes:

- **`bridge-index`**: Global synchronization. The app-side block uses this to call `clearMockDevices()` and `addMockDevice()` in the mock library, ensuring the app's "scanned" devices match the server's folders.
- **`bridge-device/<id>`**: A dedicated pipe for a specific device connection, handling the GATT structure and initialization logic.
- **`index-refresh`**: A developer-experience route that signals the browser/dashboard to reload when the mock folder structure changes.
- **`device/<id>`**: The real-time simulation stream.
  - **Downlink (Server -> App)**: Pushes state changes from the `.js` script to the app-side bridge via `setCharacteristicValue()`.
  - **Uplink (App -> Server)**: Captures app writes via the `onCharacteristicWrite` hook in the mock library and pushes them back to the Mojo logic engine.

### 3. App-Side Integration

The project leverages `react-native-ble-plx-mock` on the React Native side. This allows the application to use the standard `BleManager` API while the bridge code handles the background synchronization with the Mojo server. The app remains unaware it is talking to a simulation.

## Key Features

- **CLI Driven**: Run via `npx ble-faker -d ./mocks -p 58083`.
- **Hot Reloading**: Changes to mock `.js` files or GATT profiles are reflected in real-time.
- **Decoupled Logic**: Simulation logic lives in Node.js, keeping the mobile bundle lean.
- **Bidirectional**: Supports both notifications/reads (Server-to-App) and writes (App-to-Server).
