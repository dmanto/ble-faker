import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { app } from "../dist/index.js";

const FIXTURES = app.home.child("test", "fixtures-tick").toString();
const DEVICE_ID = "ff-00-11-22-33-01";

test("auto-tick: fires tick when disableAutoTick is false", async (t) => {
  mock.timers.enable({ apis: ["setInterval"] });
  t.after(() => mock.timers.reset());

  const ns = await app.models.namespaces.create(FIXTURES, "test", false);
  const ua = await app.newTestUserAgent();
  t.after(() => ua.stop());
  t.after(() => app.models.namespaces.destroy(ns.token));

  await ua.websocketOk(`/ns/${ns.token}/bridge/${DEVICE_ID}`, { json: true });
  await ua.messageOk(); // consume connect char — guarantees setInterval is registered

  const entry = ns.store.get(DEVICE_ID)!;
  let tickFired = false;
  entry.events.once("charUpdate", () => {
    tickFired = true;
  });

  mock.timers.tick(1000);
  assert.equal(tickFired, true);

  await ua.closeOk(1000, "");
  await ua.closedOk(1000);
});

test("auto-tick: does not fire tick when disableAutoTick is true", async (t) => {
  mock.timers.enable({ apis: ["setInterval"] });
  t.after(() => mock.timers.reset());

  const ns = await app.models.namespaces.create(FIXTURES, "test", true);
  const ua = await app.newTestUserAgent();
  t.after(() => ua.stop());
  t.after(() => app.models.namespaces.destroy(ns.token));

  await ua.websocketOk(`/ns/${ns.token}/bridge/${DEVICE_ID}`, { json: true });
  await ua.messageOk(); // consume connect char

  const entry = ns.store.get(DEVICE_ID)!;
  let tickFired = false;
  entry.events.once("charUpdate", () => {
    tickFired = true;
  });

  mock.timers.tick(1000);
  assert.equal(tickFired, false);

  await ua.closeOk(1000, "");
  await ua.closedOk(1000);
});
