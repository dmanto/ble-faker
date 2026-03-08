import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, initDeviceState } from "../dist/index.js";
import type { TestUserAgent } from "@mojojs/core";
import type { Namespace } from "../dist/index.js";

const FIXTURES_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
);
const FIXTURE_DIR = path.join(FIXTURES_ROOT, "heart-rate-monitors");
const TEST_ID = "ff-00-11-22-33-44";
const FIXTURE_JS = path.join(FIXTURE_DIR, `${TEST_ID}.js`);

test.suite("GET /ns/:token/devices", () => {
  let ua: TestUserAgent;
  let ns: Namespace;

  before(async () => {
    ns = await app.models.namespaces.create(FIXTURES_ROOT, "test");
    ua = await app.newTestUserAgent();
  });

  after(async () => {
    await ua.stop();
    await app.models.namespaces.destroy(ns.token);
  });

  test("returns empty array when store is empty", async () => {
    ns.store.remove(TEST_ID);
    await ua.getOk(`/ns/${ns.token}/devices`);
    ua.statusIs(200);
    ua.jsonIs([]);
    // restore for subsequent tests
    const state = initDeviceState(FIXTURE_DIR);
    state.dev["id"] = TEST_ID;
    ns.store.add({
      id: TEST_ID,
      categoryDir: FIXTURE_DIR,
      jsFilePath: FIXTURE_JS,
      state,
      events: new EventEmitter(),
    });
  });

  test("returns device with id", async () => {
    await ua.getOk(`/ns/${ns.token}/devices`);
    ua.statusIs(200);
    const body = JSON.parse(ua.body.toString()) as Record<string, unknown>[];
    assert.ok(body.some((d) => d["id"] === TEST_ID));
  });

  test("returns device with serviceUUIDs from gatt-profile", async () => {
    await ua.getOk(`/ns/${ns.token}/devices`);
    ua.statusIs(200);
    const body = JSON.parse(ua.body.toString()) as Record<string, unknown>[];
    const device = body.find((d) => d["id"] === TEST_ID)!;
    assert.deepEqual(device["serviceUUIDs"], ["180D"]);
  });

  test("returns device with isConnectable from gatt-profile", async () => {
    await ua.getOk(`/ns/${ns.token}/devices`);
    ua.statusIs(200);
    const body = JSON.parse(ua.body.toString()) as Record<string, unknown>[];
    const device = body.find((d) => d["id"] === TEST_ID)!;
    assert.equal(device["isConnectable"], true);
  });

  test("includes rssi fallback when device logic does not set it", async () => {
    await ua.getOk(`/ns/${ns.token}/devices`);
    ua.statusIs(200);
    const body = JSON.parse(ua.body.toString()) as Record<string, unknown>[];
    const device = body.find((d) => d["id"] === TEST_ID)!;
    assert.equal(typeof device["rssi"], "number");
  });

  test("lists multiple devices", async () => {
    const second = initDeviceState(FIXTURE_DIR);
    second.dev["id"] = "aa-bb-cc-dd-ee-ff";
    ns.store.add({
      id: "aa-bb-cc-dd-ee-ff",
      categoryDir: FIXTURE_DIR,
      jsFilePath: FIXTURE_JS,
      state: second,
      events: new EventEmitter(),
    });

    await ua.getOk(`/ns/${ns.token}/devices`);
    ua.statusIs(200);
    const body = JSON.parse(ua.body.toString()) as Record<string, unknown>[];
    const ids = body.map((d) => d["id"]);
    assert.ok(ids.includes(TEST_ID));
    assert.ok(ids.includes("aa-bb-cc-dd-ee-ff"));

    ns.store.remove("aa-bb-cc-dd-ee-ff");
  });
});
