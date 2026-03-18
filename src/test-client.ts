import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AssertionError } from "node:assert";

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
  private readonly _lastOutput = new Map<string, string>();
  private readonly _lastChar = new Map<string, string>();

  constructor(
    public readonly id: string,
    private readonly testUrl: string,
  ) {}

  // ── Setup / control ──────────────────────────────────────────────────────

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

  async tickN(count = 1): Promise<void> {
    const body = new URLSearchParams({ count: String(count) });
    const res = await fetch(`${this.testUrl}/tickN`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok && res.status !== 204)
      throw new Error(`tickN failed: ${res.status}`);
  }

  async forceDisconnect(): Promise<void> {
    const res = await fetch(`${this.testUrl}/disconnect`, { method: "POST" });
    if (!res.ok && res.status !== 204)
      throw new Error(`forceDisconnect failed: ${res.status}`);
  }

  // ── Assertions ───────────────────────────────────────────────────────────

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
    if (res.status === 408) {
      const { lastSeen } = (await res.json()) as { lastSeen: string | null };
      if (lastSeen !== null) this._lastOutput.set(name, lastSeen);
      throw new AssertionError({
        message: `waitForOutput "${name}": timed out after ${timeout}ms, last seen: ${JSON.stringify(lastSeen)}`,
        actual: lastSeen,
        expected: pattern,
        operator: "match",
      });
    }
    if (!res.ok) throw new Error(`waitForOutput failed: ${res.status}`);
    const { value } = (await res.json()) as { value: string };
    this._lastOutput.set(name, value);
    return value;
  }

  async waitForChar(
    uuid: string,
    expected: RegExp | string,
    timeout = 5000,
  ): Promise<string> {
    const pattern =
      expected instanceof RegExp ? expected.source : String(expected);
    const params = new URLSearchParams({
      uuid,
      expected: pattern,
      timeout: String(timeout),
    });
    const res = await fetch(`${this.testUrl}/char?${params}`);
    if (res.status === 408) {
      const { lastSeen } = (await res.json()) as { lastSeen: string | null };
      if (lastSeen !== null) this._lastChar.set(uuid, lastSeen);
      throw new AssertionError({
        message: `waitForChar "${uuid}": timed out after ${timeout}ms, last seen: ${JSON.stringify(lastSeen)}`,
        actual: lastSeen,
        expected: pattern,
        operator: "match",
      });
    }
    if (!res.ok) throw new Error(`waitForChar failed: ${res.status}`);
    const { value } = (await res.json()) as { value: string };
    this._lastChar.set(uuid, value);
    return value;
  }

  // ── Last seen values (available even after a timeout) ────────────────────

  lastOutput(name: string): string | undefined {
    return this._lastOutput.get(name);
  }

  lastChar(uuid: string): string | undefined {
    return this._lastChar.get(uuid);
  }
}

export class BleNamespace {
  private _devices = new Map<string, BleDevice>();

  constructor(
    public readonly token: string,
    private readonly devicesUrl: string,
  ) {}

  private async refresh(): Promise<void> {
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
      throw new Error(`device "${id}" not found in namespace`);
    return d;
  }

  /** @internal */
  static async _create(
    token: string,
    devicesUrl: string,
  ): Promise<BleNamespace> {
    const ns = new BleNamespace(token, devicesUrl);
    await ns.refresh();
    return ns;
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
    return BleNamespace._create(token, devicesUrl);
  }

  async unmount(ns: BleNamespace): Promise<void> {
    await fetch(`${this.serverUrl}/ns/${ns.token}`, { method: "DELETE" });
  }
}
