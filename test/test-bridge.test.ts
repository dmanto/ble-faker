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

test("POST /ns/:token/test/:id: emits input event on entry.events", async (t) => {
  const ns = await app.models.namespaces.create(FIXTURES_ROOT, "test");
  const ua = await app.newTestUserAgent();
  t.after(() => ua.stop());
  t.after(() => app.models.namespaces.destroy(ns.token));

  const entry = ns.store.get(TEST_ID)!;
  const inputReceived = new Promise<unknown>((resolve) => {
    entry.events.once("input", resolve);
  });

  await ua.postOk(`/ns/${ns.token}/test/${TEST_ID}`, {
    form: { name: "target", payload: "120" },
  });
  ua.statusIs(204);

  const data = await inputReceived;
  assert.deepEqual(data, { id: "target", payload: "120" });
});

test("POST /ns/:token/test/:id: returns 404 for unknown device", async (t) => {
  const ns = await app.models.namespaces.create(FIXTURES_ROOT, "test");
  const ua = await app.newTestUserAgent();
  t.after(() => ua.stop());
  t.after(() => app.models.namespaces.destroy(ns.token));

  await ua.postOk(`/ns/${ns.token}/test/00-00-00-00-00-00`, {
    form: { name: "x", payload: "y" },
  });
  ua.statusIs(404);
});

test("GET /ns/:token/test/:id: returns matched set value", async (t) => {
  const ns = await app.models.namespaces.create(FIXTURES_ROOT, "test");
  const ua = await app.newTestUserAgent();
  t.after(() => ua.stop());
  t.after(() => app.models.namespaces.destroy(ns.token));

  const entry = ns.store.get(TEST_ID)!;
  setTimeout(
    () => entry.events.emit("set", { fieldName: "current", value: "72" }),
    50,
  );

  await ua.getOk(
    `/ns/${ns.token}/test/${TEST_ID}?name=current&expected=72&timeout=2000`,
  );
  ua.statusIs(200);
  const body = JSON.parse(ua.body.toString()) as Record<string, string>;
  assert.equal(body["name"], "current");
  assert.equal(body["value"], "72");
});

test("GET /ns/:token/test/:id: returns 408 when timeout expires", async (t) => {
  const ns = await app.models.namespaces.create(FIXTURES_ROOT, "test");
  const ua = await app.newTestUserAgent();
  t.after(() => ua.stop());
  t.after(() => app.models.namespaces.destroy(ns.token));

  await ua.getOk(
    `/ns/${ns.token}/test/${TEST_ID}?name=current&expected=999&timeout=100`,
  );
  ua.statusIs(408);
});

test("GET /ns/:token/test/:id: skips non-matching set events", async (t) => {
  const ns = await app.models.namespaces.create(FIXTURES_ROOT, "test");
  const ua = await app.newTestUserAgent();
  t.after(() => ua.stop());
  t.after(() => app.models.namespaces.destroy(ns.token));

  const entry = ns.store.get(TEST_ID)!;
  // emit wrong field name, then wrong value, then the correct one
  setTimeout(() => {
    entry.events.emit("set", { fieldName: "other", value: "72" });
    entry.events.emit("set", { fieldName: "current", value: "50" });
    entry.events.emit("set", { fieldName: "current", value: "120" });
  }, 50);

  await ua.getOk(
    `/ns/${ns.token}/test/${TEST_ID}?name=current&expected=^1[0-9]{2}$&timeout=2000`,
  );
  ua.statusIs(200);
  const body = JSON.parse(ua.body.toString()) as Record<string, string>;
  assert.equal(body["value"], "120");
});

test("GET /ns/:token/test/:id: returns 404 for unknown device", async (t) => {
  const ns = await app.models.namespaces.create(FIXTURES_ROOT, "test");
  const ua = await app.newTestUserAgent();
  t.after(() => ua.stop());
  t.after(() => app.models.namespaces.destroy(ns.token));

  await ua.getOk(
    `/ns/${ns.token}/test/00-00-00-00-00-00?name=x&expected=y&timeout=100`,
  );
  ua.statusIs(404);
});

test("GET /ns/:token/devices: includes bridgeUrl and testUrl per device", async (t) => {
  const ns = await app.models.namespaces.create(FIXTURES_ROOT, "test");
  const ua = await app.newTestUserAgent();
  t.after(() => ua.stop());
  t.after(() => app.models.namespaces.destroy(ns.token));

  await ua.getOk(`/ns/${ns.token}/devices`);
  ua.statusIs(200);
  const body = JSON.parse(ua.body.toString()) as Record<string, unknown>[];
  const device = body.find((d) => d["id"] === TEST_ID)!;
  assert.ok(
    typeof device["bridgeUrl"] === "string" &&
      device["bridgeUrl"].includes(TEST_ID),
    "bridgeUrl should contain device id",
  );
  assert.ok(
    typeof device["testUrl"] === "string" &&
      device["testUrl"].includes(TEST_ID),
    "testUrl should contain device id",
  );
});
