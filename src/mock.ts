import { BleManager as MockManager } from "react-native-ble-plx-mock";
import type { MockDeviceConfig } from "react-native-ble-plx-mock";
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
  private _pollTimer: ReturnType<typeof setInterval> | null = null;
  private _inProgress = false;

  constructor(options: { bleFakerPort?: number } = {}) {
    super();
    this._url = deriveServerUrl(options.bleFakerPort ?? 3000);

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
      for (const d of devices) this.addMockDevice(d);
    } finally {
      this._inProgress = false;
    }
  }
}
