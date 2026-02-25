import { app } from "../dist/index.js";
import test from "node:test";
import assert from "node:assert/strict";

app.log.level = "trace";
const ctx = app.newMockContext();

test.suite("Mojo Helpers - calculateAdvertizingSize", async () => {
  await test("should account for mandatory 3-byte Flags", async () => {
    const size = ctx.calculateAdvertizingSize({ id: "test" });
    assert.equal(size, 3, "Empty device should still have 3 bytes for Flags");
  });

  await test("should calculate size for a standard Heart Rate Monitor (Legacy)", async () => {
    const mockDevice = {
      name: "Mojo-HR", // 7 bytes + 2 overhead = 9
      serviceUUIDs: ["180D"], // 2 bytes + 2 overhead = 4
      manufacturerData: "SGVsbG8=", // 5 bytes (Hello) + 2 overhead = 7
    };

    // Total: 3 (Flags) + 9 (Name) + 4 (UUID) + 7 (Manuf) = 23
    const size = ctx.calculateAdvertizingSize(mockDevice);
    assert.equal(size, 23);
    assert.ok(size <= 31, "Should fit in Legacy Advertising");
  });

  await test("should handle Service Data with 16-bit UUIDs", async () => {
    const mockDevice = {
      serviceData: {
        "180D": "AQI=", // 2 bytes payload + 2 bytes UUID + 2 overhead = 6
      },
    };

    // Total: 3 (Flags) + 6 = 9
    const size = ctx.calculateAdvertizingSize(mockDevice);
    assert.equal(size, 9);
  });

  await test("should detect 128-bit UUIDs and apply 16-byte penalty", async () => {
    const mockDevice = {
      serviceUUIDs: ["550e8400-e29b-41d4-a716-446655440000"], // 16 bytes + 2 overhead = 18
    };

    // Total: 3 (Flags) + 18 = 21
    const size = ctx.calculateAdvertizingSize(mockDevice);
    assert.equal(size, 21);
  });

  await test("should identify an overflow condition", async () => {
    const mockDevice = {
      name: "Very Long Device Name That Definitely Overflows", // 48 bytes
      manufacturerData:
        "SGVsbG8gd29ybGQgaG93IGFyZSB5b3UgdG9kYXkgaW4gdGhpcyBmaW5lIHdlYXRoZXI=",
    };

    const size = ctx.calculateAdvertizingSize(mockDevice);
    assert.ok(size > 31, `Size ${size} should exceed 31-byte legacy limit`);
  });
});
