import type { MojoApp } from "@mojojs/core";
import type { Device } from "react-native-ble-plx";
import vm from "node:vm";

export type DeviceLogEntry = {
  level: "log" | "warn" | "error";
  message: string;
};
export type DeviceLogicOutput = { result: unknown; logs: DeviceLogEntry[] };

type DeviceEvent =
  | { kind: "start" }
  | { kind: "tick" }
  | { kind: "reload" }
  | { kind: "advertise" }
  | { kind: "describe" }
  | { kind: "notify"; uuid: string }
  | { kind: "input"; id: string; payload: string };

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
    ): DeviceLogicOutput => {
      const logs: DeviceLogEntry[] = [];
      const capture =
        (level: DeviceLogEntry["level"]) =>
        (...args: unknown[]) =>
          logs.push({ level, message: args.map(String).join(" ") });

      const sandbox = {
        // Explicitly shadow Node.js globals that could otherwise leak through the prototype chain
        process: undefined,
        require: undefined,

        // Standard binary tools available without imports
        Buffer,
        Uint8Array,
        DataView,

        // Convenience helpers
        utils: {
          toBase64: (arr: Uint8Array) => Buffer.from(arr).toString("base64"),
          fromBase64: (str: string) => Buffer.from(str, "base64"),
          packUint16: (val: number) => {
            const b = Buffer.alloc(2);
            b.writeUInt16LE(val);
            return b.toString("base64");
          },
        },

        // Deep-cloned so logic cannot mutate server state directly
        state: JSON.parse(JSON.stringify(currentState)) as Record<
          string,
          unknown
        >,
        event,

        // Captured console — forwarded to browser view via WebSocket (TODO)
        console: {
          log: capture("log"),
          warn: capture("warn"),
          error: capture("error"),
        },
      };

      const context = vm.createContext(sandbox);

      try {
        // Strip `export default` so vm.Script (CommonJS) can evaluate the function
        const cjsCode = deviceCode.replace("export default", "__export =");
        const wrapped = `let __export;\n${cjsCode}\n__export`;
        const fn = vm.runInContext(wrapped, context, { timeout }) as (
          state: Record<string, unknown>,
          event: DeviceEvent,
        ) => unknown;
        // JSON round-trip normalises vm-context objects/arrays into host objects,
        // making the result safe to serialise and compare with deepEqual.
        const raw = fn(sandbox.state, sandbox.event);
        return { result: JSON.parse(JSON.stringify(raw)), logs };
      } catch (err) {
        // Use stack for line position info; line numbers are offset by 1 due to the `let __export;` prefix
        const message =
          err instanceof Error ? (err.stack ?? err.message) : String(err);
        console.error("Device logic error:", message);
        return { result: [], logs: [{ level: "error", message }] };
      }
    },
  );
}
