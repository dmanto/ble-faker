# ble-faker

[![CI](https://github.com/dmanto/ble-faker/actions/workflows/ci.yml/badge.svg)](https://github.com/dmanto/ble-faker/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/ble-faker)](https://www.npmjs.com/package/ble-faker)
[![License: MIT](https://img.shields.io/npm/l/ble-faker)](https://github.com/dmanto/ble-faker/blob/main/LICENSE)

Scriptable BLE peripheral simulator for React Native developers. Run realistic hardware simulations on your dev machine — no physical devices required.

---

## The problem

Building React Native apps that talk to BLE hardware is slow and fragile to test:

- You need a physical device on hand to verify any change
- Bugs that only appear on specific hardware models or firmware versions are hard to reproduce
- AI-assisted development moves fast, but every "does this work?" still means reaching for a sensor
- Demos, CI runs, and code reviews can't easily include live hardware

**ble-faker** solves this by running a local BLE peripheral server that your app connects to instead of real hardware. You define device behavior in plain JavaScript — edit a file, see the change in your app.

---

## How it works

1. Create a **category folder** with a `gatt-profile.json` describing the GATT structure
2. Add one or more **device files** named by MAC address (e.g. `FF-00-11-22-33-02.js`) containing simulation logic
3. Start the server — it exposes the devices to your React Native app via the mock bridge

Just `touch FF-00-11-22-33-02.js` to get a working device with no code: characteristics are auto-wired as inputs/outputs from the profile, with an ESP32-style default name.

---

## Getting Started

### 1. Install

```shell
pnpm add -D ble-faker
```

### 2. Create a mock folder

```text
mocks/
└── heart-rate-monitors/
    ├── gatt-profile.json
    └── FF-00-11-22-33-02.js
```

**`gatt-profile.json`** — the GATT structure, mirrors the `addMockDevice()` payload:

```json
{
  "serviceUUIDs": ["180D"],
  "isConnectable": true,
  "mtu": 247,
  "manufacturerData": "SGVsbG8gTW9qbw==",
  "services": [
    {
      "uuid": "180D",
      "characteristics": [
        { "uuid": "2A37", "properties": { "read": true, "notify": true } },
        { "uuid": "2A39", "properties": { "write": true } }
      ]
    }
  ]
}
```

**`FF-00-11-22-33-02.js`** — device logic (or `touch` it for auto-generated defaults):

```js
export default function (state, event) {
  if (event.kind === "start") {
    return [
      { name: "HR Monitor", rssi: -65 },
      { out: [{ name: "2A37", label: "Heart Rate" }] },
      { in: [{ name: "2A39", label: "Reset" }] },
    ];
  }

  if (event.kind === "tick") {
    const hr = state.vars.hr ?? 72;
    return [["2A37", utils.packUint16(hr)], { set: { "2A37": String(hr) } }];
  }

  if (event.kind === "input" && event.id === "2A39") {
    return [{ vars: { hr: 72 } }];
  }

  return [];
}
```

### 3. Start the server

```shell
npx ble-faker --dir ./mocks --port 58083
```

### 4. Open the browser dashboard

Navigate to `http://localhost:58083` to see the namespace index, then click through to a namespace dashboard. Each device shows its live UI controls — output fields update in real time as the tick event fires, and input fields let you send values to the device logic without touching the app.

---

## Device Logic

Each `.js` file exports a single default function. It receives the current `state` and an `event`, returns an array of commands:

```js
export default function (state, event) {
  // state.dev   — full GATT profile (read-only; includes services array)
  // state.vars  — your persisted values from previous calls (read-only)
  // state.chars — current characteristic values by UUID { uuid: base64 }
  // state.ui    — current browser UI controls { ins, outs }
  return [...commands];
}
```

State is **read-only** inside the function — direct writes (`state.hr = 42`) are silently discarded. Use `{ vars: { hr: 42 } }` to persist values.

### Events

| `event.kind` | when                                                      |
| ------------ | --------------------------------------------------------- |
| `start`      | every new BLE bridge connection (also warms up on load)   |
| `tick`       | periodic timer                                            |
| `reload`     | logic file changed on disk                                |
| `advertise`  | server building the advertising packet                    |
| `notify`     | characteristic notification — `uuid` + `payload` (base64) |
| `input`      | browser UI field submitted — `id` + `payload`             |

### Return commands

| Shape                         | Effect                                                        |
| ----------------------------- | ------------------------------------------------------------- |
| `['2A37', base64]`            | Update a GATT characteristic value                            |
| `{ name, rssi, … }`           | Patch the advertising packet (any `Partial<Device>` field)    |
| `{ in: [{ name, label }] }`   | Define browser input controls (text + submit → `input` event) |
| `{ out: [{ name, label }] }`  | Define browser output display fields                          |
| `{ set: { field: 'value' } }` | Push a string to a named output field via WebSocket           |
| `{ vars: { key: value } }`    | Persist values into `state.vars` for the next call            |

### Available globals (no imports needed)

| Global                   | Description                              |
| ------------------------ | ---------------------------------------- |
| `Buffer`                 | Node.js Buffer                           |
| `Uint8Array`, `DataView` | Binary views                             |
| `utils.toBase64(arr)`    | `Uint8Array → base64 string`             |
| `utils.fromBase64(str)`  | `base64 → Buffer`                        |
| `utils.packUint16(n)`    | little-endian uint16 → base64            |
| `console.log/warn/error` | captured and forwarded to the browser UI |

### Sandbox security

Logic files run in an isolated `node:vm` context. They cannot access `process`, `require`, the filesystem, or the network. They are pure functions that safely simulate hardware state transitions.

---

## Default behavior (empty `.js` file)

`touch FF-00-11-22-33-02.js` gives you a working device without any code:

- **Device name**: `ESP32_` + last 5 hex chars of the MAC address
- **RSSI**: −65 dBm
- Characteristics with `read`/`notify` → browser output fields, labeled from the standard GATT table
- Characteristics with `write` → browser input fields

Use this to verify your profile is correct, then add logic as needed.

---

## Programmatic API

```ts
import { bleMockServer } from "ble-faker";

await bleMockServer.start({ dir: "./mocks", port: 58083 });
const info = await bleMockServer.get(); // { version, dir }
await bleMockServer.stop();
```

---

## Development commands

| Command           | Description                             |
| :---------------- | :-------------------------------------- |
| `pnpm dev`        | Watch mode (rebuilds on source changes) |
| `pnpm build`      | Compile to `dist/`                      |
| `pnpm test`       | Run tests (Node.js native test runner)  |
| `pnpm build:test` | Build + test in one step                |
| `pnpm lint`       | oxlint                                  |

---

## Contributing

PRs welcome. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the internal design.

**License:** MIT
