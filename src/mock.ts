import { BleManager as MockManager } from "react-native-ble-plx-mock";
import type {
  MockDeviceConfig,
  ServiceConfig,
} from "react-native-ble-plx-mock";
import { NativeModules, Platform } from "react-native";
import { getMockConfig } from "./mock-config.js";

// Augment the minimal react-native stub to include Platform.
declare module "react-native" {
  const Platform: { OS: string };
}

export * from "react-native-ble-plx-mock";

const POLL_INTERVAL_MS = 5000;

export class BleManager extends MockManager {
  private _serverBase: string | null = null;
  private _dir: string | null = null;
  private _label: string | null = null;
  private _devicesUrl: string | null = null;
  private _bridgeUrl: string | null = null;
  private _mountPromise: Promise<void> | null = null;
  private _pollTimer: ReturnType<typeof setInterval> | null = null;
  private _inProgress = false;
  // deviceId → Map<charUUID, serviceUUID>  (both lowercase)
  private _charServiceMap = new Map<string, Map<string, string>>();
  // deviceId → WebSocket
  private _bridgeWs = new Map<string, WebSocket>();
  // messages queued while WS is still CONNECTING
  private _bridgeQueue = new Map<string, string[]>();
  // advertisedId (platform-specific) → server-side MAC used for bridge routing
  private _advertisedToMac = new Map<string, string>();

  constructor() {
    super();
    this.onStartScan(() => {
      void this._mount()
        .then(() => {
          void this._poll();
          this._pollTimer = setInterval(
            () => void this._poll(),
            POLL_INTERVAL_MS,
          );
        })
        .catch((err: unknown) => {
          console.error("[ble-faker] mount failed:", err);
        });
    });

    this.onStopScan(() => {
      if (this._pollTimer !== null) {
        clearInterval(this._pollTimer);
        this._pollTimer = null;
      }
    });
  }

  private async _metroOrigin(): Promise<string> {
    // Standard React Native: Metro bundle URL exposed via NativeModules.SourceCode
    const scriptURL = (NativeModules.SourceCode as { scriptURL?: string })
      ?.scriptURL;
    if (scriptURL) {
      try {
        return new URL(scriptURL).origin;
      } catch {}
    }
    // Expo managed workflow: host available via expo-constants
    try {
      const { default: Constants } = await import("expo-constants");
      const hostUri =
        Constants.expoConfig?.hostUri ?? Constants.manifest?.debuggerHost;
      if (hostUri) return `http://${hostUri}`;
    } catch {}
    return "http://localhost:8081";
  }

  private _mount(): Promise<void> {
    if (this._mountPromise) return this._mountPromise;
    const p = (async () => {
      // Jest path: config injected by BleTestClient.mount() via shared globalThis.
      // Skip the Metro fetch and the /mount call entirely — the test client has
      // already mounted the namespace with the correct settings (e.g. disableAutoTick).
      const injected = getMockConfig();
      if (injected) {
        this._devicesUrl = injected.devicesUrl;
        this._bridgeUrl = injected.bridgeUrl;
        return;
      }

      // Metro path: fetch config from the Metro middleware, then mount.
      const metroOrigin = await this._metroOrigin();
      console.log("[ble-faker] connecting to metro at", metroOrigin);
      const cfgRes = await fetch(`${metroOrigin}/ble-faker-config`);
      if (!cfgRes.ok)
        throw new Error(
          `[ble-faker] Metro did not serve /ble-faker-config from ${metroOrigin}. ` +
            `Did you start with BLE_MOCK=true and add withBleFaker() to metro.config.js?`,
        );
      const { port, dir, label } = (await cfgRes.json()) as {
        port: number;
        dir: string;
        label: string;
      };
      const host = new URL(metroOrigin).hostname;
      this._serverBase = `http://${host}:${port}`;
      this._dir = dir;
      this._label = label;

      const res = await fetch(`${this._serverBase}/mount`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ dir, label }).toString(),
      });
      if (!res.ok) throw new Error(`ble-faker: mount failed (${res.status})`);
      const { devicesUrl, bridgeUrl } = (await res.json()) as {
        devicesUrl: string;
        bridgeUrl: string;
      };
      this._devicesUrl = devicesUrl;
      this._bridgeUrl = bridgeUrl;
    })();
    this._mountPromise = p.catch((err: unknown) => {
      this._mountPromise = null; // allow retry on next scan
      throw err;
    });
    return this._mountPromise;
  }

  private async _poll(): Promise<void> {
    if (this._inProgress || !this._devicesUrl) return;
    this._inProgress = true;
    try {
      let devices: MockDeviceConfig[] = [];
      try {
        const res = await fetch(this._devicesUrl);
        if (res.ok) {
          const raw = (await res.json()) as Partial<MockDeviceConfig>[];
          devices = raw.filter(
            (d): d is MockDeviceConfig => typeof d.id === "string",
          );
        }
      } catch {
        // server unreachable — treat as empty list
      }
      this.clearMockDevices();
      this._advertisedToMac.clear();
      for (const d of devices) {
        const advertisedId = this._toAdvertisedId(d.id);
        this._advertisedToMac.set(advertisedId, d.id);
        this.addMockDevice({ ...d, id: advertisedId });
        // Build char→service lookup keyed by advertisedId
        const map = new Map<string, string>();
        for (const svc of (d.services ?? []) as ServiceConfig[]) {
          for (const char of svc.characteristics ?? []) {
            map.set(char.uuid.toLowerCase(), svc.uuid.toLowerCase());
          }
        }
        this._charServiceMap.set(advertisedId, map);
      }
    } finally {
      this._inProgress = false;
    }
  }

  override async connectToDevice(
    ...args: Parameters<MockManager["connectToDevice"]>
  ) {
    const device = await super.connectToDevice(...args);
    this._openBridge(device.id);
    return device;
  }

  override async cancelDeviceConnection(
    ...args: Parameters<MockManager["cancelDeviceConnection"]>
  ) {
    const device = await super.cancelDeviceConnection(...args);
    this._closeBridge(device.id);
    return device;
  }

  override async writeCharacteristicWithResponseForDevice(
    ...args: Parameters<MockManager["writeCharacteristicWithResponseForDevice"]>
  ) {
    const result = await super.writeCharacteristicWithResponseForDevice(
      ...args,
    );
    const [deviceId, , charUUID, value] = args;
    this._sendOrQueue(deviceId, {
      uuid: charUUID.toLowerCase(),
      payload: value,
    });
    return result;
  }

  override async writeCharacteristicWithoutResponseForDevice(
    ...args: Parameters<
      MockManager["writeCharacteristicWithoutResponseForDevice"]
    >
  ) {
    const result = await super.writeCharacteristicWithoutResponseForDevice(
      ...args,
    );
    const [deviceId, , charUUID, value] = args;
    this._sendOrQueue(deviceId, {
      uuid: charUUID.toLowerCase(),
      payload: value,
    });
    return result;
  }

  private _sendOrQueue(deviceId: string, msg: object): void {
    const json = JSON.stringify(msg);
    const queue = this._bridgeQueue.get(deviceId);
    if (queue) {
      queue.push(json);
      return;
    }
    this._bridgeWs.get(deviceId)?.send(json);
  }

  // Translate the server-side normalized MAC to the platform-appropriate format.
  // Android real devices use AA:BB:CC:DD:EE:FF; iOS uses a CoreBluetooth UUID.
  // The server always routes by MAC — _advertisedToMac provides the reverse mapping.
  private _toAdvertisedId(mac: string): string {
    if (Platform.OS === "ios") {
      // Deterministic UUID derived from MAC so the format matches real iOS behaviour.
      // Real CoreBluetooth UUIDs are opaque, but this is stable and UUID-shaped.
      const hex = mac.replace(/-/g, "");
      return `00000000-0000-4000-8000-${hex}`;
    }
    // Android: uppercase with colons — matches real react-native-ble-plx output.
    return mac.replace(/-/g, ":").toUpperCase();
  }

  private _openBridge(deviceId: string): void {
    if (!this._bridgeUrl) return;
    // Close any stale bridge from a previous session before opening a fresh one
    this._closeBridge(deviceId);
    const queue: string[] = [];
    this._bridgeQueue.set(deviceId, queue);
    // Bridge URL uses the server-side MAC, not the advertised (platform-specific) ID.
    const mac = this._advertisedToMac.get(deviceId) ?? deviceId;
    const ws = new WebSocket(this._bridgeUrl.replace(":id", mac));
    ws.onopen = () => {
      this._bridgeQueue.delete(deviceId);
      for (const msg of queue) ws.send(msg);
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as {
          type?: string;
          uuid?: string;
          value?: string;
        };
        if (msg.type === "char") {
          if (!msg.uuid || msg.value === undefined) return;
          const charUUID = msg.uuid.toLowerCase();
          const serviceUUID = this._charServiceMap.get(deviceId)?.get(charUUID);
          if (!serviceUUID) return;
          this.setCharacteristicValue(
            deviceId,
            serviceUUID,
            charUUID,
            msg.value,
          );
        } else if (msg.type === "disconnect") {
          const disconnectError = new Error("Device was disconnected");
          // this.simulateDeviceDisconnection(deviceId, disconnectError);
          // The mock library only fires connectionListeners on simulateDeviceDisconnection;
          // it does not error out characteristic monitors. The app detects disconnection via
          // monitor errors containing "was disconnected", so we trigger those explicitly.
          const charMap = this._charServiceMap.get(deviceId);
          if (charMap) {
            const [charUUID, serviceUUID] =
              charMap.entries().next().value ?? [];
            if (charUUID && serviceUUID) {
              console.log(`Simulating characteristic error for ${charUUID}`);
              this.simulateCharacteristicError(
                deviceId,
                serviceUUID,
                charUUID,
                disconnectError,
              );
            }
          }
          this._closeBridge(deviceId);
        } else if (msg.type === "readError" && msg.uuid) {
          const charUUID = msg.uuid.toLowerCase();
          const serviceUUID = this._charServiceMap.get(deviceId)?.get(charUUID);
          if (serviceUUID) {
            this.simulateCharacteristicReadError(
              deviceId,
              serviceUUID,
              charUUID,
              new Error("Simulated read error"),
            );
          }
        } else if (msg.type === "clearReadError" && msg.uuid) {
          const charUUID = msg.uuid.toLowerCase();
          const serviceUUID = this._charServiceMap.get(deviceId)?.get(charUUID);
          if (serviceUUID) {
            this.clearCharacteristicReadError(deviceId, serviceUUID, charUUID);
          }
        }
      } catch {
        // ignore malformed messages
      }
    };
    ws.onclose = () => {
      // Guard: only clean up if this ws is still the active bridge (not superseded)
      if (this._bridgeWs.get(deviceId) === ws) {
        this._bridgeWs.delete(deviceId);
        this._bridgeQueue.delete(deviceId);
      }
    };
    this._bridgeWs.set(deviceId, ws);
  }

  private _closeBridge(deviceId: string): void {
    const ws = this._bridgeWs.get(deviceId);
    if (ws) {
      ws.close();
      this._bridgeWs.delete(deviceId);
    }
  }
}
