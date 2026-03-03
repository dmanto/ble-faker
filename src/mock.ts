import { BleManager as MockManager } from "react-native-ble-plx-mock";
import type {
  MockDeviceConfig,
  ServiceConfig,
} from "react-native-ble-plx-mock";
import Constants from "expo-constants";

export * from "react-native-ble-plx-mock";

const POLL_INTERVAL_MS = 5000;

function deriveServerUrl(port: number): string {
  const hostUri = Constants.expoConfig?.hostUri ?? "localhost:8081";
  const host = hostUri.split(":")[0] ?? "localhost";
  return `http://${host}:${port}`;
}

export class BleManager extends MockManager {
  private _url: string;
  private _wsUrl: string;
  private _pollTimer: ReturnType<typeof setInterval> | null = null;
  private _inProgress = false;
  // deviceId → Map<charUUID, serviceUUID>  (both lowercase)
  private _charServiceMap = new Map<string, Map<string, string>>();
  // deviceId → WebSocket
  private _bridgeWs = new Map<string, WebSocket>();
  // messages queued while WS is still CONNECTING
  private _bridgeQueue = new Map<string, string[]>();

  constructor(options: { bleFakerPort?: number } = {}) {
    super();
    this._url = deriveServerUrl(options.bleFakerPort ?? 3000);
    this._wsUrl = this._url.replace(/^http/, "ws");

    this.onStartScan(() => {
      void this._poll();
      this._pollTimer = setInterval(() => void this._poll(), POLL_INTERVAL_MS);
    });

    this.onStopScan(() => {
      if (this._pollTimer !== null) {
        clearInterval(this._pollTimer);
        this._pollTimer = null;
      }
    });
  }

  private async _poll(): Promise<void> {
    if (this._inProgress) return;
    this._inProgress = true;
    try {
      let devices: MockDeviceConfig[] = [];
      try {
        const res = await fetch(`${this._url}/devices`);
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
      for (const d of devices) {
        this.addMockDevice(d);
        // Build char→service lookup so WS messages can find the right service UUID
        const map = new Map<string, string>();
        for (const svc of (d.services ?? []) as ServiceConfig[]) {
          for (const char of svc.characteristics ?? []) {
            map.set(char.uuid.toLowerCase(), svc.uuid.toLowerCase());
          }
        }
        this._charServiceMap.set(d.id, map);
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

  private _openBridge(deviceId: string): void {
    // Close any stale bridge from a previous session before opening a fresh one
    this._closeBridge(deviceId);
    const queue: string[] = [];
    this._bridgeQueue.set(deviceId, queue);
    const ws = new WebSocket(`${this._wsUrl}/bridge/${deviceId}`);
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
        if (msg.type !== "char" || !msg.uuid || msg.value === undefined) return;
        const charUUID = msg.uuid.toLowerCase();
        const serviceUUID = this._charServiceMap.get(deviceId)?.get(charUUID);
        if (!serviceUUID) return;
        this.setCharacteristicValue(deviceId, serviceUUID, charUUID, msg.value);
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
