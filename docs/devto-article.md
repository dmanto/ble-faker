# Simulating BLE Hardware for React Native Development (No Device Required)

If you're building a React Native app that talks to BLE hardware, you know the drill: you need the physical device nearby for every single change you want to test. The device has limited availability. The firmware is half-finished. You can't run automated tests in CI. And demoing to stakeholders means hoping the device cooperates.

I built **ble-faker** to solve this. It lets you replace physical BLE hardware with a scriptable simulator that runs on your dev machine. Your app code doesn't change — the same `react-native-ble-plx` calls that talk to real hardware talk to the simulator instead.

This post walks through how it works, how to set it up, and how the demo app below was built with it.

![ble-faker demo](https://raw.githubusercontent.com/dmanto/ble-faker/main/docs/demo.gif)

---

## How it works

ble-faker has two parts:

1. **A server** — a Node.js process that holds device state, runs your device logic, and exposes a browser dashboard. Start it with `npx ble-faker --port 58083`.

2. **A mock client** — a drop-in replacement for `react-native-ble-plx`. You configure Metro to redirect the import, and your app's existing BLE calls (`startDeviceScan`, `connectToDevice`, `monitorCharacteristicForService`, etc.) work as before — against the simulator.

The mock client connects to the server over WebSocket. When your app scans, the server runs the `advertise` event on each device file and returns the advertising packets. When your app connects, a WebSocket bridge opens and the server starts firing `tick` events once per second. When your app writes a characteristic, the server fires a `notify` event. Everything flows through device logic files you write in JavaScript.

---

## Device logic files

Each simulated device is a single JavaScript file named by its MAC address (e.g. `aa-bb-cc-dd-ee-11.js`), sitting inside a category folder alongside a `gatt-profile.json`:

```
mocks/
└── heart-rate/
    ├── gatt-profile.json
    └── aa-bb-cc-dd-ee-11.js
```

The logic file exports a single function that receives the current device state and an event, and returns a list of commands:

```js
/// <reference types="ble-faker/device" />

const HEART_RATE_CHARACTERISTIC = "00002a37-0000-1000-8000-00805f9b34fb";

export default function (state, event) {
  const { vars } = state;

  if (event.kind === "advertise") {
    return [{ name: "CorSense", rssi: -62 }];
  }

  if (event.kind === "start") {
    return [
      { vars: { bpm: 72 } },
      { in: [{ name: "bpm", label: "Heart rate (bpm)" }] },
      { out: [{ name: "bpm", label: "Current BPM" }] },
    ];
  }

  if (event.kind === "tick") {
    const delta = Math.round((Math.random() - 0.5) * 6);
    const bpm = Math.max(45, Math.min(180, vars.bpm + delta));
    return [
      { vars: { bpm } },
      heartRatePayload(bpm),
      { set: { bpm: `${bpm} bpm` } },
    ];
  }

  if (event.kind === "input" && event.id === "bpm") {
    const bpm = Math.max(
      0,
      Math.min(255, parseInt(event.payload, 10) || vars.bpm),
    );
    return [
      { vars: { bpm } },
      heartRatePayload(bpm),
      { set: { bpm: `${bpm} bpm` } },
    ];
  }
}

function heartRatePayload(bpm) {
  const buf = Buffer.alloc(2);
  buf[0] = 0x00; // flags: 8-bit BPM format
  buf[1] = bpm & 0xff;
  return [HEART_RATE_CHARACTERISTIC, buf.toString("base64")];
}
```

Each call returns an array of commands that tell the server what to do:

| Command shape                 | Effect                                  |
| ----------------------------- | --------------------------------------- |
| `['uuid', base64]`            | Push a characteristic value to the app  |
| `{ name, rssi }`              | Update the device's advertising packet  |
| `{ vars: { key: value } }`    | Persist state for the next call         |
| `{ in: [{ name, label }] }`   | Define browser input controls           |
| `{ out: [{ name, label }] }`  | Define browser output fields            |
| `{ set: { field: 'value' } }` | Push a string to a browser output field |
| `{ disconnect: true }`        | Simulate a device disconnection         |

The device logic runs in an isolated `node:vm` context with a 50ms CPU budget. No access to the filesystem or network. `Buffer`, `Uint8Array`, and a few helpers (`utils.toBase64`, `utils.packUint16`) are available as globals — no imports needed.

---

## Setting up the demo app

To show this in action, I built a small Expo app: a heart rate monitor that scans for a CorSense device, connects to it, and displays a live BPM reading. The full source is at [github.com/dmanto/ble-faker-demo](https://github.com/dmanto/ble-faker-demo).

The app itself is standard `react-native-ble-plx` code:

```tsx
const HEART_RATE_SERVICE = "0000180d-0000-1000-8000-00805f9b34fb";
const HEART_RATE_CHARACTERISTIC = "00002a37-0000-1000-8000-00805f9b34fb";

const connect = async (device: Device) => {
  const conn = await manager.connectToDevice(device.id);
  await conn.discoverAllServicesAndCharacteristics();
  setConnected(conn);

  conn.monitorCharacteristicForService(
    HEART_RATE_SERVICE,
    HEART_RATE_CHARACTERISTIC,
    (err, char) => {
      if (err) {
        setConnected(null);
        setLostConnection(true); // unexpected disconnect — show warning screen
        return;
      }
      const bytes = Uint8Array.from(atob(char.value), (c) => c.charCodeAt(0));
      const bpm =
        (bytes[0] & 0x01) === 0 ? bytes[1] : (bytes[1] << 8) + bytes[2];
      setHeartRate(bpm);
    },
  );
};
```

No mock-awareness in the app at all. The only mock-specific change is in `metro.config.js`.

### Metro config

```js
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");

const config = getDefaultConfig(__dirname);

if (process.env.BLE_MOCK === "true") {
  let bleFakerPort = 58083;
  try {
    const state = JSON.parse(
      fs.readFileSync(
        path.join(process.env.HOME, ".ble-faker-server.json"),
        "utf8",
      ),
    );
    if (state.port) bleFakerPort = state.port;
  } catch {}

  const mockDir = path.join(__dirname, "mocks");
  const mockLabel = "ble-faker demo";
  const bleFakerRoot = path.resolve(__dirname, "node_modules/ble-faker");

  config.watchFolders = [...(config.watchFolders ?? []), bleFakerRoot];

  // Serve config to the mock client
  config.server = {
    ...config.server,
    enhanceMiddleware: (middleware) => (req, res, next) => {
      if (req.url === "/ble-faker-config") {
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            port: bleFakerPort,
            dir: mockDir,
            label: mockLabel,
          }),
        );
        return;
      }
      middleware(req, res, next);
    },
  };

  // Redirect react-native-ble-plx → ble-faker mock
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === "react-native-ble-plx") {
      return {
        filePath: path.join(bleFakerRoot, "dist/mock.js"),
        type: "sourceFile",
      };
    }
    return context.resolveRequest(context, moduleName, platform);
  };
}

module.exports = config;
```

### package.json scripts

```json
"scripts": {
  "ble:start":    "ble-faker --port 58083",
  "ble:stop":     "ble-faker stop",
  "start:mock":   "cross-env BLE_MOCK=true expo start --clear",
  "ios:mock":     "cross-env BLE_MOCK=true expo start --ios --clear",
  "android:mock": "cross-env BLE_MOCK=true expo start --android --clear"
}
```

`cross-env` handles the env var on Windows.

### Running it

```sh
npm install
npm run ble:start     # start the simulator
npm run ios:mock      # or android:mock, or start:mock for Expo Go
```

Open `http://localhost:58083` in your browser. You'll see the device dashboard — live output fields showing the current BPM, and an input field to override it. The app side sees characteristic updates exactly like it would from real hardware.

---

## Unexpected disconnects

One of the more useful things to test with ble-faker is how your app handles a device dropping the connection unexpectedly. This is genuinely hard to test with physical hardware — you have to pull a battery or walk out of range.

With ble-faker you return `{ disconnect: true }` from your device logic (or trigger it from the browser dashboard) and the mock client calls `simulateDeviceDisconnection` on the app side, which fires the `monitorCharacteristicForService` callback with an error — exactly the path real hardware takes.

The demo app handles this by checking `err` in the monitor callback and showing a "Connection Lost" screen.

---

## Testing

ble-faker ships a test client at `ble-faker/test` that gives you a typed API to drive the simulator from test code — no HTTP or WebSocket knowledge needed:

```ts
import { BleTestClient } from "ble-faker/test";
import { before, after, describe, it } from "node:test";

describe("heart rate monitor", () => {
  const client = BleTestClient.connect();
  let ns: Awaited<ReturnType<typeof client.mount>>;

  before(async () => {
    ns = await client.mount({ dir: "./mocks", label: "HR test" });
  });

  after(async () => {
    await client.unmount(ns);
  });

  it("pushes a heart rate characteristic on each tick", async () => {
    const device = ns.device("aa-bb-cc-dd-ee-11");
    await device.tickN(1);
    await device.waitForChar("00002a37-0000-1000-8000-00805f9b34fb", /.+/);
  });

  it("accepts a manual BPM override", async () => {
    const device = ns.device("aa-bb-cc-dd-ee-11");
    await device.input("bpm", "120");
    await device.waitForOutput("bpm", "120 bpm");
  });
});
```

`tickN(n)` advances the simulated clock by `n` seconds without waiting real time. `waitForChar` and `waitForOutput` both check the current value immediately and throw an `AssertionError` on timeout — no manual assert needed.

For full-stack tests, the app can run under Detox or Maestro with `BLE_MOCK=true` while the test client drives the device side. You can tap a button in the app and then call `tickN(60)` to advance a simulated minute, all in the same test.

---

## Install

```sh
npm install --save-dev ble-faker
# or
pnpm add -D ble-faker
```

- **npm:** [npmjs.com/package/ble-faker](https://www.npmjs.com/package/ble-faker)
- **GitHub:** [github.com/dmanto/ble-faker](https://github.com/dmanto/ble-faker)
- **Demo app:** [github.com/dmanto/ble-faker-demo](https://github.com/dmanto/ble-faker-demo)

---

## What's next

A few things I'm planning or considering:

- **Multiple connected apps** — currently one bridge per device; supporting multiple simultaneous app connections would help multi-device test scenarios
- **Characteristic read support** — `readCharacteristicForService` works via a snapshot of current char state; `readError` injection is already supported for failure testing
- **More examples** — the smart bulb example in `examples/` shows a more complex device with power-draw simulation, colour temperature, and overheating fault injection

PRs welcome — the internal design is documented in [docs/ARCHITECTURE.md](https://github.com/dmanto/ble-faker/blob/main/docs/ARCHITECTURE.md).
