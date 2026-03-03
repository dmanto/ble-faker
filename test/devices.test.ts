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
  const state = initDeviceState(FIXTURE_DIR);
  state.dev["id"] = TEST_ID;
  return {
    id: TEST_ID,
    categoryDir: FIXTURE_DIR,
    jsFilePath: FIXTURE_JS,
    state,
    events: new EventEmitter(),
  };
}

test.suite("GET /devices", () => {
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

  test("returns empty array when store is empty", async () => {
    app.models.store.remove(TEST_ID);
    await ua.getOk("/devices");
    ua.statusIs(200);
    ua.jsonIs([]);
  });

  test("returns device with id", async () => {
    await ua.getOk("/devices");
    ua.statusIs(200);
    const body = JSON.parse(ua.body.toString()) as Record<string, unknown>[];
    const device = body.find((d) => d["id"] === TEST_ID);
    assert.ok(device !== undefined, "device not found in response");
  });

  test("returns device with serviceUUIDs from gatt-profile", async () => {
    await ua.getOk("/devices");
    ua.statusIs(200);
    const body = JSON.parse(ua.body.toString()) as Record<string, unknown>[];
    const device = body.find((d) => d["id"] === TEST_ID)!;
    assert.ok(device !== undefined, "device not found");
    assert.deepEqual(device["serviceUUIDs"], ["180D"]);
  });

  test("returns device with isConnectable from gatt-profile", async () => {
    await ua.getOk("/devices");
    ua.statusIs(200);
    const body = JSON.parse(ua.body.toString()) as Record<string, unknown>[];
    const device = body.find((d) => d["id"] === TEST_ID)!;
    assert.ok(device !== undefined, "device not found");
    assert.equal(device["isConnectable"], true);
  });

  test("includes rssi fallback when device logic does not set it", async () => {
    await ua.getOk("/devices");
    ua.statusIs(200);
    const body = JSON.parse(ua.body.toString()) as Record<string, unknown>[];
    const device = body.find((d) => d["id"] === TEST_ID)!;
    assert.ok(device !== undefined, "device not found");
    assert.equal(typeof device["rssi"], "number");
  });

  test("lists multiple devices", async () => {
    const second = makeEntry();
    second.id = "aa-bb-cc-dd-ee-ff";
    second.state.dev["id"] = "aa-bb-cc-dd-ee-ff";
    app.models.store.add(second);

    await ua.getOk("/devices");
    ua.statusIs(200);
    const body = JSON.parse(ua.body.toString()) as Record<string, unknown>[];
    const ids = body.map((d) => d["id"]);
    assert.ok(ids.includes(TEST_ID), "first device missing");
    assert.ok(ids.includes("aa-bb-cc-dd-ee-ff"), "second device missing");

    app.models.store.remove("aa-bb-cc-dd-ee-ff");
  });
});
