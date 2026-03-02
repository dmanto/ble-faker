import test, { after, before, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, initDeviceState } from "../dist/index.js";
import type { TestUserAgent } from "@mojojs/core";

const FIXTURE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures/heart-rate-monitors",
);
const TEST_ID = "ff-00-11-22-33-44";
const FIXTURE_JS = path.join(FIXTURE_DIR, `${TEST_ID}.js`);

function makeEntry() {
  return {
    id: TEST_ID,
    categoryDir: FIXTURE_DIR,
    jsFilePath: FIXTURE_JS,
    state: initDeviceState(FIXTURE_DIR),
    events: new EventEmitter(),
  };
}

test.suite("ble-bridge", () => {
  let ua: TestUserAgent;

  before(async () => {
    ua = await app.newTestUserAgent();
  });

  after(async () => {
    await ua.stop();
  });

  beforeEach(() => {
    app.models.store.add(makeEntry());
  });

  afterEach(() => {
    app.models.store.remove(TEST_ID);
  });

  test("sends char update on start", async () => {
    await ua.websocketOk(`/bridge/${TEST_ID}`, { json: true });
    const msg = (await ua.messageOk()) as Record<string, string>;
    assert.equal(msg["type"], "char");
    assert.equal(msg["uuid"], "2A37");
    assert.equal(msg["value"], "AAEC");
    await ua.closeOk(1000, "");
    await ua.closedOk(1000);
  });

  test("echoes notify payload back as char update", async () => {
    await ua.websocketOk(`/bridge/${TEST_ID}`, { json: true });
    await ua.messageOk(); // consume initial char from start
    await ua.sendOk({ uuid: "2A37", payload: "BBBB" });
    const msg = (await ua.messageOk()) as Record<string, string>;
    assert.equal(msg["type"], "char");
    assert.equal(msg["uuid"], "2A37");
    assert.equal(msg["value"], "BBBB");
    await ua.closeOk(1000, "");
    await ua.closedOk(1000);
  });
});

test.suite("browser-bridge", () => {
  let ua: TestUserAgent;

  before(async () => {
    ua = await app.newTestUserAgent();
  });

  after(async () => {
    await ua.stop();
  });

  beforeEach(() => {
    app.models.store.add(makeEntry());
  });

  afterEach(() => {
    app.models.store.remove(TEST_ID);
  });

  test("sends initial UI on connect", async () => {
    await ua.websocketOk(`/browser/${TEST_ID}`, { json: true });
    const msg = (await ua.messageOk()) as Record<string, unknown>;
    assert.equal(msg["type"], "ui");
    const ui = msg["ui"] as Record<string, unknown>;
    assert.ok(Array.isArray(ui["ins"]));
    assert.ok(Array.isArray(ui["outs"]));
    await ua.closeOk(1000, "");
    await ua.closedOk(1000);
  });

  test("forwards input message to device events", async () => {
    const entry = app.models.store.get(TEST_ID)!;
    const inputReceived = new Promise<unknown>((resolve) => {
      entry.events.once("input", resolve);
    });

    await ua.websocketOk(`/browser/${TEST_ID}`, { json: true });
    await ua.messageOk(); // consume initial ui
    await ua.sendOk({ type: "input", id: "btn1", payload: "hello" });
    const data = await inputReceived;
    assert.deepEqual(data, { id: "btn1", payload: "hello" });
    await ua.closeOk(1000, "");
    await ua.closedOk(1000);
  });
});
