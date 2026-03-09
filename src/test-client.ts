import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const STATE_FILE =
  process.env.BLE_FAKER_STATE ??
  path.join(os.homedir(), ".ble-faker-server.json");

interface ServerState {
  url: string;
}

interface DeviceInfo {
  id: string;
  testUrl: string;
  [key: string]: unknown;
}

interface MountResponse {
  token: string;
  devicesUrl: string;
}

export class BleDevice {
  constructor(
    public readonly id: string,
    private readonly testUrl: string,
  ) {}

  async input(name: string, payload: string): Promise<void> {
    const body = new URLSearchParams({ name, payload });
    const res = await fetch(this.testUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok && res.status !== 204)
      throw new Error(`input failed: ${res.status}`);
  }

  async waitForOutput(
    name: string,
    expected: RegExp | string,
    timeout = 5000,
  ): Promise<string> {
    const pattern =
      expected instanceof RegExp ? expected.source : String(expected);
    const params = new URLSearchParams({
      name,
      expected: pattern,
      timeout: String(timeout),
    });
    const res = await fetch(`${this.testUrl}?${params}`);
    if (res.status === 408)
      throw new Error(
        `waitForOutput: timed out after ${timeout}ms waiting for "${name}"`,
      );
    if (!res.ok) throw new Error(`waitForOutput failed: ${res.status}`);
    const { value } = (await res.json()) as { value: string };
    return value;
  }
}

export class BleNamespace {
  private _devices = new Map<string, BleDevice>();

  constructor(
    public readonly token: string,
    private readonly devicesUrl: string,
  ) {}

  async refresh(): Promise<void> {
    const res = await fetch(this.devicesUrl);
    if (!res.ok) throw new Error(`refresh failed: ${res.status}`);
    const list = (await res.json()) as DeviceInfo[];
    this._devices = new Map(
      list
        .filter(
          (d) => typeof d.id === "string" && typeof d.testUrl === "string",
        )
        .map((d) => [d.id, new BleDevice(d.id, d.testUrl)]),
    );
  }

  device(id: string): BleDevice {
    const d = this._devices.get(id);
    if (d === undefined)
      throw new Error(
        `device "${id}" not found — call ns.refresh() if it was recently added`,
      );
    return d;
  }
}

export class BleTestClient {
  private constructor(private readonly serverUrl: string) {}

  static connect(): BleTestClient {
    const state = JSON.parse(
      fs.readFileSync(STATE_FILE, "utf8"),
    ) as ServerState;
    return new BleTestClient(state.url);
  }

  async mount({
    dir = "./mocks",
    label,
  }: { dir?: string; label?: string } = {}): Promise<BleNamespace> {
    const body = new URLSearchParams({ dir, label: label ?? dir });
    const res = await fetch(`${this.serverUrl}/mount`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) throw new Error(`mount failed: ${res.status}`);
    const { token, devicesUrl } = (await res.json()) as MountResponse;
    const ns = new BleNamespace(token, devicesUrl);
    await ns.refresh();
    return ns;
  }

  async unmount(ns: BleNamespace): Promise<void> {
    await fetch(`${this.serverUrl}/ns/${ns.token}`, { method: "DELETE" });
  }
}
