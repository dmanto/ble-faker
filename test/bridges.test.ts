import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app } from "../dist/index.js";

const FIXTURES_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
);
const TEST_ID = "ff-00-11-22-33-44";

test("ble-bridge: sends char update on start", async (t) => {
  const ns = await app.models.namespaces.create(FIXTURES_ROOT, "test");
  const ua = await app.newTestUserAgent();
  t.after(() => ua.stop());
  t.after(() => app.models.namespaces.destroy(ns.token));

  await ua.websocketOk(`/ns/${ns.token}/bridge/${TEST_ID}`, { json: true });
  const msg = (await ua.messageOk()) as Record<string, string>;
  assert.equal(msg["type"], "char");
  assert.equal(msg["uuid"], "2A37");
  assert.equal(msg["value"], "AAEC");
  await ua.closeOk(1000, "");
  await ua.closedOk(1000);
});

test("ble-bridge: echoes notify payload back as char update", async (t) => {
  const ns = await app.models.namespaces.create(FIXTURES_ROOT, "test");
  const ua = await app.newTestUserAgent();
  t.after(() => ua.stop());
  t.after(() => app.models.namespaces.destroy(ns.token));

  await ua.websocketOk(`/ns/${ns.token}/bridge/${TEST_ID}`, { json: true });
  await ua.messageOk(); // consume initial char from start
  await ua.sendOk({ uuid: "2A37", payload: "BBBB" });
  const msg = (await ua.messageOk()) as Record<string, string>;
  assert.equal(msg["type"], "char");
  assert.equal(msg["uuid"], "2A37");
  assert.equal(msg["value"], "BBBB");
  await ua.closeOk(1000, "");
  await ua.closedOk(1000);
});

test("browser-bridge: sends initial UI on connect", async (t) => {
  const ns = await app.models.namespaces.create(FIXTURES_ROOT, "test");
  const ua = await app.newTestUserAgent();
  t.after(() => ua.stop());
  t.after(() => app.models.namespaces.destroy(ns.token));

  await ua.websocketOk(`/ns/${ns.token}/browser/${TEST_ID}`, { json: true });
  const msg = (await ua.messageOk()) as Record<string, unknown>;
  assert.equal(msg["type"], "ui");
  const ui = msg["ui"] as Record<string, unknown>;
  assert.ok(Array.isArray(ui["ins"]));
  assert.ok(Array.isArray(ui["outs"]));
  await ua.closeOk(1000, "");
  await ua.closedOk(1000);
});

test("browser-bridge: forwards input message to device events", async (t) => {
  const ns = await app.models.namespaces.create(FIXTURES_ROOT, "test");
  const ua = await app.newTestUserAgent();
  t.after(() => ua.stop());
  t.after(() => app.models.namespaces.destroy(ns.token));

  const entry = ns.store.get(TEST_ID)!;
  const inputReceived = new Promise<unknown>((resolve) => {
    entry.events.once("input", resolve);
  });

  await ua.websocketOk(`/ns/${ns.token}/browser/${TEST_ID}`, { json: true });
  await ua.messageOk(); // consume initial ui
  await ua.sendOk({ type: "input", id: "btn1", payload: "hello" });
  const data = await inputReceived;
  assert.deepEqual(data, { id: "btn1", payload: "hello" });
  await ua.closeOk(1000, "");
  await ua.closedOk(1000);
});
