import { app } from "../dist/index.js";
import test from "node:test";
import assert from "node:assert/strict";

app.log.level = "error";
const ctx = app.newMockContext();

test.suite("runDeviceLogic", async () => {
  // --- core behaviour ---

  await test("function declaration returns characteristic updates", async () => {
    const expected = Buffer.alloc(2);
    expected.writeUInt16LE(72);
    const { result, logs } = ctx.runDeviceLogic(
      `export default function(state, event) {
        return [['2A37', utils.packUint16(72)]];
      }`,
      {},
      { kind: "tick" },
    );
    assert.equal(logs.length, 0);
    assert.deepEqual(result, [["2A37", expected.toString("base64")]]);
  });

  await test("arrow function export works", async () => {
    const { result } = ctx.runDeviceLogic(
      `export default (state, event) => [['2A37', utils.packUint16(0)]];`,
      {},
      { kind: "tick" },
    );
    assert.ok(Array.isArray(result));
  });

  await test("returns empty array when event is unhandled", async () => {
    const { result } = ctx.runDeviceLogic(
      `export default function(state, event) { return []; }`,
      {},
      { kind: "start" },
    );
    assert.deepEqual(result, []);
  });

  await test("receives state and can read from it", async () => {
    const expected = Buffer.alloc(2);
    expected.writeUInt16LE(90);
    const { result } = ctx.runDeviceLogic(
      `export default function(state, event) {
        return [['2A37', utils.packUint16(state.hr)]];
      }`,
      { hr: 90 },
      { kind: "tick" },
    );
    assert.deepEqual(result, [["2A37", expected.toString("base64")]]);
  });

  // --- utils ---

  await test("packUint16 encodes little-endian correctly", async () => {
    const { result } = ctx.runDeviceLogic(
      `export default function() { return utils.packUint16(0x0102); }`,
      {},
      { kind: "tick" },
    );
    const expected = Buffer.from([0x02, 0x01]).toString("base64");
    assert.equal(result, expected);
  });

  await test("toBase64 and fromBase64 round-trip", async () => {
    const { result } = ctx.runDeviceLogic(
      `export default function() {
        const buf = utils.fromBase64(utils.toBase64(new Uint8Array([1, 2, 3])));
        return Array.from(buf);
      }`,
      {},
      { kind: "tick" },
    );
    assert.deepEqual(result, [1, 2, 3]);
  });

  // --- console capture ---

  await test("console.log appears in logs with level log", async () => {
    const { logs } = ctx.runDeviceLogic(
      `export default function() { console.log("hello", "world"); return []; }`,
      {},
      { kind: "tick" },
    );
    assert.equal(logs.length, 1);
    assert.equal(logs[0]?.level, "log");
    assert.equal(logs[0]?.message, "hello world");
  });

  await test("console.warn and console.error captured with correct level", async () => {
    const { logs } = ctx.runDeviceLogic(
      `export default function() {
        console.warn("careful");
        console.error("boom");
        return [];
      }`,
      {},
      { kind: "tick" },
    );
    assert.equal(logs.length, 2);
    assert.equal(logs[0]?.level, "warn");
    assert.equal(logs[1]?.level, "error");
  });

  await test("multiple console calls are ordered", async () => {
    const { logs } = ctx.runDeviceLogic(
      `export default function() {
        console.log("one");
        console.log("two");
        console.log("three");
        return [];
      }`,
      {},
      { kind: "tick" },
    );
    assert.deepEqual(
      logs.map((l: { message: string }) => l.message),
      ["one", "two", "three"],
    );
  });

  // --- state isolation ---

  await test("mutating state inside logic does not affect original", async () => {
    const original = { hr: 60 };
    ctx.runDeviceLogic(
      `export default function(state) { state.hr = 999; return []; }`,
      original,
      { kind: "tick" },
    );
    assert.equal(original.hr, 60);
  });

  // --- error handling ---

  await test("syntax error returns empty result and error log", async () => {
    const { result, logs } = ctx.runDeviceLogic(
      `export default function() { return [[[; }`,
      {},
      { kind: "tick" },
    );
    assert.deepEqual(result, []);
    assert.equal(logs.length, 1);
    assert.equal(logs[0]?.level, "error");
  });

  await test("runtime throw returns empty result and error log with stack", async () => {
    const { result, logs } = ctx.runDeviceLogic(
      `export default function() { throw new Error("oops"); }`,
      {},
      { kind: "tick" },
    );
    assert.deepEqual(result, []);
    assert.equal(logs[0]?.level, "error");
    assert.match(logs[0]?.message ?? "", /oops/);
  });

  // --- sandbox security ---

  await test("process is not accessible", async () => {
    const { result } = ctx.runDeviceLogic(
      `export default function() {
        return [['ok', typeof process === 'undefined' ? 'yes' : 'no']];
      }`,
      {},
      { kind: "tick" },
    );
    assert.deepEqual(result, [["ok", "yes"]]);
  });

  await test("require is not accessible", async () => {
    const { result } = ctx.runDeviceLogic(
      `export default function() {
        return [['ok', typeof require === 'undefined' ? 'yes' : 'no']];
      }`,
      {},
      { kind: "tick" },
    );
    assert.deepEqual(result, [["ok", "yes"]]);
  });
});
