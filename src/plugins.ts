import type { MojoApp } from "@mojojs/core";
import type { Device } from "react-native-ble-plx";

export function registerPlugins(app: MojoApp): void {
  app.addHelper("calculateAdvertizingSize", (ctx, mockedDevice: Partial<Device>) => {
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
  });
}
