# 🧬 BLE Live Mock Server

[![CI](https://github.com/dmanto/ble-faker/actions/workflows/ci.yml/badge.svg)](https://github.com/dmanto/ble-faker/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/ble-faker)](https://www.npmjs.com/package/ble-faker)
[![License: MIT](https://img.shields.io/npm/l/ble-faker)](https://github.com/dmanto/ble-faker/blob/main/LICENSE)

A universal **Bluetooth Low Energy (BLE)** peripheral emulator powered by [mojo.js](https://mojojs.org/). This server allows mobile developers to simulate complex hardware behavior by simply editing JSON files in their IDE.

Changes to your mock files are broadcasted in **real-time** via WebSockets to your React Native app, enabling a "Hot Reload" experience for hardware integration.

---

## ✨ Features

- **File-Based GATT Table:** Every device is a `.json` file. No massive, unmanageable config objects.
- **Live Sync:** Powered by WebSockets. Save a file in VS Code → App updates instantly.
- **Bidirectional:** Supports both reading from the mock and writing back (Mojo can update the JSON on disk).
- **Logic Offloading:** Move complex sensor math (heart rate drift, battery curves) from the app to the Node.js server.
- **Universal:** Works with any BLE library, but optimized for `react-native-ble-plx-mock`.

---

## 📂 Project Structure

```text
bridge-server-app/
├── mocks/
│   ├── heart-rate-monitors/       # Category folder (example)
│   │   ├── gatt-profile.json            # GATT structure (see below)
│   │   ├── FF-00-11-22-33-02.js   # Instance 1: "Simulated Runner"
│   │   └── AA-BB-CC-DD-EE-99.js   # Instance 2: "Tachycardia Test"
│   └── battery/                   # Category folder (other example)
│       ├── gatt-profile.json
│       └── 01-23-45-67-89-AB.js    # Some battery
├── src/
│   ├── index.ts         # Mojo entry point & WebSocket routing
│   ├── models/          # Mojo models
│   ├── plugins.ts       # Plugin engines (i.e. watches files & broadcasts)
│   └── controllers/     # Handlers for Browser Dashboard & BLE Sync
├── views/               # Mojo view templates go here
├── test/                # Mojo TestUserAgent integration tests
├── dist/                # Production build (ignored by git)
├── config.json          # app configuration
├── .npmrc               # pnpm configuration
├── .oxlintrc.json
├── package.json         # Managed via pnpm
├── pnpm-lock.json       # pnpm's deterministic lockfile
├── vite.config.js
└── tsconfig.json        # Strict TS config for IDE support
```

---

## 🚀 Getting Started

### 1. Installation

pnpm add -D ble-live-mock-server

### 2. Initialize Mocks

Create a folder named `ble-specs` in your project root with a `gatt-profile.json`:

````json
{
  "serviceUUIDs": ["180D"],
  "services": [
    {
      "uuid": "180D",
      "characteristics": [
        {
          "uuid": "2A37",
          "properties": { "read": true, "notify": true }
        }
      ]
    }
  ]
}```

### 3. Start the Server

# Binds to 0.0.0.0 to allow connections from emulators and physical devices

```shell
npx ble-live-mock -d ./ble-specs -p 58083
````

The server will start on `http://0.0.0.0:58083`.

## 🧠 Logic Engines (.js)

For dynamic behavior, create a .js file matching a MAC address (XX-XX-XX-XX-XX-XX.json) or device ID (myId.json), inside the category folder.

Input: state (current data), event (start | tick | notify)
Output: Array<[UUID, Base64Value]> (Deltas to apply)

```JavaScript
export default function(state, event) {
  if (event.kind === 'tick') {
    const hr = Math.floor(60 + Math.random() * 5);
    return [['2A37', Buffer.from([0, hr]).toString('base64')]];
  }
  return [];
}
```

## 🛡️ Sandbox Security

## Scripts run in a node:vm isolated context. They cannot access process, filesystem, or network. They are pure functions designed to safely simulate hardware state transitions.

## 📱 React Native Integration

To connect your app to the live mock, use the WebSocket bridge. It automatically detects your Metro server's IP to ensure connectivity on both physical devices and emulators.

```javascript
import { NativeModules } from "react-native";
import { ConnectToBridge } from "react-native-ble-mocker";
import { MockBleManager } from "react-native-ble-plx-mock";

const getWsUrl = () => {
  // Extract the host from the Metro bundle URL (handles localhost vs LAN IP)
  const scriptURL = NativeModules.SourceCode.scriptURL;
  if (!scriptURL) return "ws://localhost:58083/ble-bridge";

  const host = scriptURL.split("://")[1].split(":")[0];
  return `ws://${host}:58083/ble-bridge`;
};

// Connect and pipe into your mock manager
ConnectToBridge(MockBleManager, getWsUrl);
```

---

## 🛠 Development Commands

| Command      | Description                                           |
| :----------- | :---------------------------------------------------- |
| `pnpm dev`   | Starts Mojo server with `--watch` for logic changes.  |
| `pnpm test`  | Runs native Node.js tests for the GATT logic.         |
| `pnpm build` | Compiles TypeScript to the `dist/` folder using Vite. |
| `pnpm lint`  | Runs `oxlint` for high-speed code quality checks.     |

---

## 🤝 Contributing

This project is built with **mojo.js**. As a community-driven tool, feel free to submit PRs focusing on the reactivity engine, file-watcher performance, or adding new BLE service templates.

**License:** MIT
