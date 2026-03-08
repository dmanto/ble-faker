import test, { after, before } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app } from "../dist/index.js";
import type { TestUserAgent } from "@mojojs/core";

const FIXTURES_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
);

test.suite("GET /", () => {
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

  test("renders namespace index page", async () => {
    await ua.getOk("/");
    ua.statusIs(200);
    ua.elementExists("h1");
  });

  test("shows mounted namespace label as link to dashboard", async () => {
    const ns = await app.models.namespaces.create(FIXTURES_ROOT, "my-device");
    await ua.getOk("/");
    ua.statusIs(200);
    ua.elementExists(`a[href="/ns/${ns.token}"]`);
    ua.textLike(`a[href="/ns/${ns.token}"]`, /my-device/);
  });

  test("empty state shows guidance message", async () => {
    // Fresh ua against a clean namespaces state — remove any from prior tests
    for (const ns of app.models.namespaces.all()) {
      await app.models.namespaces.destroy(ns.token);
    }
    await ua.getOk("/");
    ua.statusIs(200);
    ua.bodyLike(/No namespaces mounted/);
  });
});
