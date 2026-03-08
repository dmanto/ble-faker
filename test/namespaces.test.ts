import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app } from "../dist/index.js";
import type { TestUserAgent } from "@mojojs/core";

const FIXTURES_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
);
const FIXTURE_DIR = path.join(FIXTURES_ROOT, "heart-rate-monitors");

test.suite("POST /mount and DELETE /ns/:token", () => {
  let ua: TestUserAgent;

  before(async () => {
    ua = await app.newTestUserAgent();
  });

  after(async () => {
    for (const ns of app.models.namespaces.all()) {
      await app.models.namespaces.destroy(ns.token);
    }
    await ua.stop();
  });

  test("mount returns token, label and fully-qualified urls", async () => {
    await ua.postOk("/mount", {
      form: { dir: FIXTURE_DIR, label: "my-sim" },
    });
    ua.statusIs(200);
    const body = JSON.parse(ua.body.toString()) as Record<string, string>;
    assert.equal(typeof body["token"], "string");
    assert.equal(body["label"], "my-sim");
    assert.ok(body["devicesUrl"]?.includes("/ns/"));
    assert.ok(body["bridgeUrl"]?.startsWith("ws://"));
    assert.ok(body["bridgeUrl"]?.endsWith("/:id"));
    assert.ok(body["browserUrl"]?.startsWith("ws://"));
    await app.models.namespaces.destroy(body["token"]!);
  });

  test("label defaults to dir when omitted", async () => {
    await ua.postOk("/mount", { form: { dir: FIXTURE_DIR } });
    ua.statusIs(200);
    const body = JSON.parse(ua.body.toString()) as Record<string, string>;
    assert.equal(body["label"], FIXTURE_DIR);
    await app.models.namespaces.destroy(body["token"]!);
  });

  test("unmount returns 204 and removes namespace", async () => {
    await ua.postOk("/mount", {
      form: { dir: FIXTURE_DIR, label: "temp" },
    });
    const { token } = JSON.parse(ua.body.toString()) as { token: string };
    await ua.deleteOk(`/ns/${token}`);
    ua.statusIs(204);
    assert.equal(app.models.namespaces.get(token), undefined);
  });

  test("mounting the same dir twice returns the same token", async () => {
    await ua.postOk("/mount", { form: { dir: FIXTURE_DIR, label: "first" } });
    const { token: t1 } = JSON.parse(ua.body.toString()) as { token: string };
    await ua.postOk("/mount", { form: { dir: FIXTURE_DIR, label: "second" } });
    const { token: t2, label } = JSON.parse(ua.body.toString()) as {
      token: string;
      label: string;
    };
    assert.equal(t1, t2);
    assert.equal(label, "second");
    await app.models.namespaces.destroy(t1);
  });

  test("unknown token returns 404", async () => {
    await ua.deleteOk("/ns/notavalidtoken");
    ua.statusIs(404);
  });

  test("GET /ns/:token renders namespace dashboard", async () => {
    await ua.postOk("/mount", {
      form: { dir: FIXTURES_ROOT, label: "dash-test" },
    });
    const { token } = JSON.parse(ua.body.toString()) as { token: string };
    await ua.getOk(`/ns/${token}`);
    ua.statusIs(200);
    ua.typeLike(/text\/html/);
    ua.textLike("h1", /dash-test/);
    ua.elementExists(".device");
    await app.models.namespaces.destroy(token);
  });

  test("GET /ns/:token with unknown token returns 404", async () => {
    await ua.getOk("/ns/notavalidtoken");
    ua.statusIs(404);
  });
});
