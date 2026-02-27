import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { bleMockServer } from "../dist/index.js";

test.suite("Server lifecycle via state file", () => {
  before(async () => {
    await bleMockServer.start({ dir: "./foo", port: 58083 });
  });

  after(() => {
    bleMockServer.stop();
  });

  test("state file contains reachable url that returns version and dir", async () => {
    const res = (await bleMockServer.get()) as { version: string; dir: string };
    assert.equal(typeof res.version, "string");
    assert.equal(res.dir, "./foo");
  });
});
