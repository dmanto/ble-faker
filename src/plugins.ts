import type { MojoApp } from "@mojojs/core";
import type { Device } from "react-native-ble-plx";
import vm from "node:vm";

export type DeviceLogEntry = {
  level: "log" | "warn" | "error";
  message: string;
};
export type DeviceLogicOutput = { result: unknown; logs: DeviceLogEntry[] };

export type DeviceEvent =
  | { kind: "start" }
  | { kind: "connect" }
  | { kind: "disconnect" }
  | { kind: "tick" }
  | { kind: "advertise" }
  | { kind: "notify"; uuid: string; payload: string }
  | { kind: "input"; id: string; payload: string };

export function runDeviceLogic(
  deviceCode: string,
  currentState: object,
  event: DeviceEvent,
  timeout = 50,
): DeviceLogicOutput {
  const logs: DeviceLogEntry[] = [];
  const capture =
    (level: DeviceLogEntry["level"]) =>
    (...args: unknown[]) =>
      logs.push({ level, message: args.map(String).join(" ") });

  const sandbox = {
    process: undefined,
    require: undefined,
    Buffer,
    Uint8Array,
    DataView,
    TextEncoder,
    TextDecoder,
    utils: {
      toBase64: (arr: Uint8Array) => Buffer.from(arr).toString("base64"),
      fromBase64: (str: string) => Buffer.from(str, "base64"),
      // Pack helpers — all little-endian (standard for GATT/BLE SIG specs)
      packUint8: (val: number) => Buffer.from([val & 0xff]).toString("base64"),
      packInt8: (val: number) => {
        const b = Buffer.alloc(1);
        b.writeInt8(val);
        return b.toString("base64");
      },
      packUint16: (val: number) => {
        const b = Buffer.alloc(2);
        b.writeUInt16LE(val);
        return b.toString("base64");
      },
      packInt16: (val: number) => {
        const b = Buffer.alloc(2);
        b.writeInt16LE(val);
        return b.toString("base64");
      },
      packUint32: (val: number) => {
        const b = Buffer.alloc(4);
        b.writeUInt32LE(val);
        return b.toString("base64");
      },
      packFloat32: (val: number) => {
        const b = Buffer.alloc(4);
        b.writeFloatLE(val);
        return b.toString("base64");
      },
      // Unpack helpers — inverse of the pack functions above
      unpackUint8: (b64: string) => Buffer.from(b64, "base64").readUInt8(0),
      unpackInt8: (b64: string) => Buffer.from(b64, "base64").readInt8(0),
      unpackUint16: (b64: string) => Buffer.from(b64, "base64").readUInt16LE(0),
      unpackInt16: (b64: string) => Buffer.from(b64, "base64").readInt16LE(0),
      unpackUint32: (b64: string) => Buffer.from(b64, "base64").readUInt32LE(0),
      unpackFloat32: (b64: string) => Buffer.from(b64, "base64").readFloatLE(0),
    },
    state: JSON.parse(JSON.stringify(currentState)) as Record<string, unknown>,
    event,
    console: {
      log: capture("log"),
      warn: capture("warn"),
      error: capture("error"),
    },
  };

  const context = vm.createContext(sandbox);

  try {
    const cjsCode = deviceCode.replace("export default", "__export =");
    const wrapped = `let __export;\n${cjsCode}\n__export`;
    const fn = vm.runInContext(wrapped, context, { timeout }) as (
      state: Record<string, unknown>,
      event: DeviceEvent,
    ) => unknown;
    const raw = fn(sandbox.state, sandbox.event);
    return { result: JSON.parse(JSON.stringify(raw)), logs };
  } catch (err) {
    const message =
      err instanceof Error ? (err.stack ?? err.message) : String(err);
    console.error("Device logic error:", message);
    return { result: [], logs: [{ level: "error", message }] };
  }
}

export function registerPlugins(app: MojoApp): void {
  app.addHelper(
    "calculateAdvertizingSize",
    (ctx, mockedDevice: Partial<Device>) => {
      let size = 0;

      // 1. Flags: Mandatory for almost all discoverable/connectable devices
      size += 3;

      // 2. Local Name (Type 0x08 or 0x09)
      if (mockedDevice.name) {
        size += 2 + Buffer.byteLength(mockedDevice.name, "utf-8");
      }

      // 3. Manufacturer Data (Type 0xFF)
      if (mockedDevice.manufacturerData) {
        // Base64 decoded to actual bytes
        size += 2 + Buffer.from(mockedDevice.manufacturerData, "base64").length;
      }

      // 4. Service Data (Type 0x16, 0x20, or 0x21)
      if (mockedDevice.serviceData) {
        for (const uuid in mockedDevice.serviceData) {
          const data = mockedDevice.serviceData[uuid];
          if (data === undefined) continue;
          const dataBuf = Buffer.from(data, "base64");
          // Overhead: 1 (len) + 1 (type) + (2 or 16 for UUID)
          const uuidHeaderSize = uuid.length <= 4 ? 2 : 16;
          size += 2 + uuidHeaderSize + dataBuf.length;
        }
      }

      // 5. Service UUIDs (Type 0x02, 0x03, 0x06, 0x07)
      // Note: Usually grouped into one AD structure per UUID size
      if (mockedDevice.serviceUUIDs && mockedDevice.serviceUUIDs.length > 0) {
        const hasShort = mockedDevice.serviceUUIDs.some((u) => u.length <= 4);
        const hasLong = mockedDevice.serviceUUIDs.some((u) => u.length > 4);

        if (hasShort) size += 2; // Header for the 16-bit list
        if (hasLong) size += 2; // Header for the 128-bit list

        for (const uuid of mockedDevice.serviceUUIDs) {
          size += uuid.length <= 4 ? 2 : 16;
        }
      }

      return size;
    },
  );
  app.addHelper(
    "runDeviceLogic",
    (
      ctx,
      deviceCode: string,
      currentState: Record<string, unknown>,
      event: DeviceEvent,
      timeout = 50,
    ): DeviceLogicOutput =>
      runDeviceLogic(deviceCode, currentState, event, timeout),
  );
}

declare module "@mojojs/core" {
  interface MojoContext {
    calculateAdvertizingSize: (mockedDevice: Partial<Device>) => number;
    runDeviceLogic: (
      deviceCode: string,
      currentState: object,
      event: DeviceEvent,
      timeout?: number,
    ) => DeviceLogicOutput;
  }
}
