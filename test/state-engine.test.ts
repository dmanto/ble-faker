import { applyCommands, emptyDeviceState, initDeviceState } from "../dist/index.js";
import type { DeviceState } from "../src/models/store.js";
import type { ApplyResult } from "../src/state-engine.js";
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, "fixtures");

test.suite("applyCommands", async () => {
  await test("characteristic update — [uuid, base64] sets chars", async () => {
    const current = emptyDeviceState() as unknown as DeviceState;
    const { state } = applyCommands([["2A37", "AAAA=="]], current) as unknown as ApplyResult;
    assert.equal(state.chars["2A37"], "AAAA==");
  });

  await test("dev patch — plain object merged into state.dev", async () => {
    const current = emptyDeviceState() as unknown as DeviceState;
    const { state } = applyCommands([{ name: "HR Monitor", rssi: -60 }], current) as unknown as ApplyResult;
    assert.equal(state.dev["name"], "HR Monitor");
    assert.equal(state.dev["rssi"], -60);
  });

  await test("in definition — replaces state.ui.ins", async () => {
    const current = emptyDeviceState() as unknown as DeviceState;
    const ins = [{ name: "bpm", label: "Heart Rate" }];
    const { state } = applyCommands([{ in: ins }], current) as unknown as ApplyResult;
    assert.deepEqual(state.ui.ins, ins);
  });

  await test("out definition — replaces state.ui.outs", async () => {
    const current = emptyDeviceState() as unknown as DeviceState;
    const outs = [{ name: "display", label: "Display" }];
    const { state } = applyCommands([{ out: outs }], current) as unknown as ApplyResult;
    assert.deepEqual(state.ui.outs, outs);
  });

  await test("set — produces correct wsMessages, state unchanged", async () => {
    const current = emptyDeviceState() as unknown as DeviceState;
    const { state, wsMessages } = applyCommands(
      [{ set: { heartRate: "72 bpm" } }],
      current,
    ) as unknown as ApplyResult;
    assert.deepEqual(wsMessages, [{ fieldName: "heartRate", value: "72 bpm" }]);
    assert.deepEqual(state.dev, {});
  });

  await test("vars — merges into state.vars, accepts non-string values", async () => {
    const current = emptyDeviceState() as unknown as DeviceState;
    const { state } = applyCommands([{ vars: { count: 5, flag: true } }], current) as unknown as ApplyResult;
    assert.equal(state.vars["count"], 5);
    assert.equal(state.vars["flag"], true);
  });

  await test("mixed commands — all applied correctly in one call", async () => {
    const current = emptyDeviceState() as unknown as DeviceState;
    const { state, wsMessages } = applyCommands(
      [
        ["2A37", "AAAA=="],
        { name: "HR" },
        { in: [{ name: "x", label: "X" }] },
        { out: [{ name: "y", label: "Y" }] },
        { set: { foo: "bar" } },
        { vars: { n: 1 } },
      ],
      current,
    ) as unknown as ApplyResult;
    assert.equal(state.chars["2A37"], "AAAA==");
    assert.equal(state.dev["name"], "HR");
    assert.equal(state.ui.ins.length, 1);
    assert.equal(state.ui.outs.length, 1);
    assert.deepEqual(wsMessages, [{ fieldName: "foo", value: "bar" }]);
    assert.equal(state.vars["n"], 1);
  });

  await test("non-array result — returns current state unchanged", async () => {
    const current = emptyDeviceState() as unknown as DeviceState;
    const { state, wsMessages } = applyCommands(null, current) as unknown as ApplyResult;
    assert.equal(state, current);
    assert.deepEqual(wsMessages, []);
  });

  await test("invalid items (wrong types) — silently ignored", async () => {
    const current = emptyDeviceState() as unknown as DeviceState;
    // array with wrong-typed elements, number, boolean
    const { state } = applyCommands(
      [["2A37"], [42, true], 99, false, null, undefined],
      current,
    ) as unknown as ApplyResult;
    assert.deepEqual(state.chars, {});
    assert.deepEqual(state.dev, {});
  });

  await test("state immutability — current not mutated after applyCommands", async () => {
    const current = emptyDeviceState() as unknown as DeviceState;
    applyCommands(
      [
        ["2A37", "AAAA=="],
        { name: "Test" },
        { vars: { x: 1 } },
        { in: [{ name: "a", label: "A" }] },
      ],
      current,
    );
    assert.deepEqual(current.chars, {});
    assert.deepEqual(current.dev, {});
    assert.deepEqual(current.vars, {});
    assert.deepEqual(current.ui.ins, []);
  });
});

test.suite("initDeviceState", async () => {
  await test("reads gatt-profile.json and populates dev and chars", async () => {
    const categoryDir = path.join(FIXTURES, "heart-rate-monitors");
    const state = initDeviceState(categoryDir) as unknown as DeviceState;

    // dev should have top-level fields (no services)
    assert.deepEqual(state.dev["serviceUUIDs"], ["180D"]);
    assert.equal(state.dev["isConnectable"], true);
    assert.equal(state.dev["mtu"], 247);
    assert.equal(state.dev["manufacturerData"], "SGVsbG8gTW9qbw==");
    assert.ok("services" in state.dev);

    // chars should have empty string for each characteristic uuid
    assert.equal(state.chars["2A37"], "");

    // vars and ui should be empty
    assert.deepEqual(state.vars, {});
    assert.deepEqual(state.ui, { ins: [], outs: [] });
  });
});
