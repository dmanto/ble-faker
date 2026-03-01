import { app, DEFAULT_DEVICE_CODE } from "../dist/index.js";
import test from "node:test";
import assert from "node:assert/strict";

app.log.level = "error";
const ctx = app.newMockContext();

const HEART_RATE_STATE = {
  dev: {
    id: "aa-bb-cc-dd-ee-ff",
    serviceUUIDs: ["180D"],
    services: [
      {
        uuid: "180D",
        characteristics: [
          { uuid: "2A37", properties: { read: true, notify: true } },
          { uuid: "2A38", properties: { read: true } },
          { uuid: "2A39", properties: { write: true } },
        ],
      },
    ],
  },
  vars: {},
  chars: { "2A37": "", "2A38": "", "2A39": "" },
  ui: { ins: [], outs: [] },
};

test.suite("DEFAULT_DEVICE_CODE", async () => {
  await test("start — sets ESP32 name from last 5 hex chars of MAC", async () => {
    const { result } = ctx.runDeviceLogic(DEFAULT_DEVICE_CODE, HEART_RATE_STATE, { kind: "start" });
    assert.ok(Array.isArray(result));
    const patch = (result as unknown[]).find(
      (c): c is { name: string; rssi: number } =>
        typeof c === "object" && c !== null && "name" in (c as object),
    );
    // 'aabbccddeeff'.slice(-5).toUpperCase() === 'EEFF' — last 5 of 12 hex chars
    assert.equal(patch?.name, "ESP32_DEEFF");
    assert.equal(patch?.rssi, -65);
  });

  await test("start — read/notify chars become outputs with GATT labels", async () => {
    const { result } = ctx.runDeviceLogic(DEFAULT_DEVICE_CODE, HEART_RATE_STATE, { kind: "start" });
    const outCmd = (result as unknown[]).find(
      (c): c is { out: Array<{ name: string; label: string }> } =>
        typeof c === "object" && c !== null && "out" in (c as object),
    );
    assert.ok(outCmd, "expected an { out: [...] } command");
    assert.equal(outCmd.out.length, 2);
    assert.equal(outCmd.out[0]?.name, "2A37");
    assert.equal(outCmd.out[0]?.label, "Heart Rate Measurement");
    assert.equal(outCmd.out[1]?.name, "2A38");
    assert.equal(outCmd.out[1]?.label, "Body Sensor Location");
  });

  await test("start — write chars become inputs with GATT labels", async () => {
    const { result } = ctx.runDeviceLogic(DEFAULT_DEVICE_CODE, HEART_RATE_STATE, { kind: "start" });
    const inCmd = (result as unknown[]).find(
      (c): c is { in: Array<{ name: string; label: string }> } =>
        typeof c === "object" && c !== null && "in" in (c as object),
    );
    assert.ok(inCmd, "expected an { in: [...] } command");
    assert.equal(inCmd.in.length, 1);
    assert.equal(inCmd.in[0]?.name, "2A39");
    assert.equal(inCmd.in[0]?.label, "Heart Rate Control Point");
  });

  await test("start — unknown UUID falls back to raw UUID as label", async () => {
    const state = {
      dev: {
        services: [{ uuid: "FFFF", characteristics: [{ uuid: "FF01", properties: { read: true } }] }],
      },
      vars: {},
      chars: {},
      ui: { ins: [], outs: [] },
    };
    const { result } = ctx.runDeviceLogic(DEFAULT_DEVICE_CODE, state, { kind: "start" });
    const outCmd = (result as unknown[]).find(
      (c): c is { out: Array<{ name: string; label: string }> } =>
        typeof c === "object" && c !== null && "out" in (c as object),
    );
    assert.equal(outCmd?.out[0]?.label, "FF01");
  });

  await test("start — no services produces only name/rssi patch", async () => {
    const state = { dev: { id: "00-00-00-00-00-01" }, vars: {}, chars: {}, ui: { ins: [], outs: [] } };
    const { result } = ctx.runDeviceLogic(DEFAULT_DEVICE_CODE, state, { kind: "start" });
    assert.ok(Array.isArray(result));
    assert.equal((result as unknown[]).length, 1);
  });

  await test("reload — behaves identically to start", async () => {
    const start = ctx.runDeviceLogic(DEFAULT_DEVICE_CODE, HEART_RATE_STATE, { kind: "start" });
    const reload = ctx.runDeviceLogic(DEFAULT_DEVICE_CODE, HEART_RATE_STATE, { kind: "reload" });
    assert.deepEqual(start.result, reload.result);
  });

  await test("input — returns characteristic update with base64 payload", async () => {
    const { result } = ctx.runDeviceLogic(
      DEFAULT_DEVICE_CODE,
      HEART_RATE_STATE,
      { kind: "input", id: "2A39", payload: "hello" },
    );
    assert.ok(Array.isArray(result));
    const cmd = (result as unknown[])[0];
    assert.ok(Array.isArray(cmd));
    assert.equal((cmd as unknown[])[0], "2A39");
    assert.equal((cmd as unknown[])[1], Buffer.from("hello").toString("base64"));
  });

  await test("unknown event kind — returns empty array", async () => {
    const { result } = ctx.runDeviceLogic(DEFAULT_DEVICE_CODE, HEART_RATE_STATE, { kind: "tick" });
    assert.deepEqual(result, []);
  });
});
