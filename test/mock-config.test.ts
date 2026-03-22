import test, { suite } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, type ChildProcess } from "node:child_process";
import { getMockConfig, setMockConfig } from "../dist/mock-config.js";
import { BleTestClient } from "../dist/test-client.js";
import { app } from "../dist/index.js";

const BIN_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../dist/bin.js",
);
const FIXTURES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
);

let testSeq = 0;
function tempStateFile(): string {
  return path.join(os.tmpdir(), `ble-faker-mc-${process.pid}-${++testSeq}.json`);
}
function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address() as net.AddressInfo;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}
async function startServer(port: number, stateFile: string): Promise<ChildProcess> {
  const child = spawn(process.execPath, [BIN_PATH, "--port", String(port)], {
    env: { ...process.env, BLE_FAKER_STATE: stateFile },
    stdio: "ignore",
  });
  const url = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return child;
    } catch {}
    await new Promise<void>((r) => setTimeout(r, 100));
  }
  child.kill();
  throw new Error(`server did not start within 10s`);
}
function stopServer(child: ChildProcess, stateFile: string): void {
  try { child.kill("SIGTERM"); } catch {}
  try { fs.unlinkSync(stateFile); } catch {}
}

// ── Unit tests: shared-state mechanism ───────────────────────────────────────

suite("mock-config shared state", () => {
  test("getMockConfig returns null initially", () => {
    // The module-level variable starts as null. Tests run in separate Node.js
    // worker processes, so each test file gets a fresh module instance.
    // Within this test file we reset manually to avoid order-dependence.
    setMockConfig(null as unknown as { devicesUrl: string; bridgeUrl: string });
    assert.equal(getMockConfig(), null);
  });

  test("setMockConfig / getMockConfig round-trip", () => {
    setMockConfig({
      devicesUrl: "http://127.0.0.1:9999/ns/abc/devices",
      bridgeUrl: "ws://127.0.0.1:9999/ns/abc/bridge/:id",
    });
    const cfg = getMockConfig();
    assert.equal(cfg?.devicesUrl, "http://127.0.0.1:9999/ns/abc/devices");
    assert.equal(cfg?.bridgeUrl, "ws://127.0.0.1:9999/ns/abc/bridge/:id");
  });
});

// ── Integration test: BleTestClient.mount() → mock config ────────────────────

suite("BleTestClient.mount() populates mock config", () => {
  let child: ChildProcess;
  let stateFile: string;
  let serverUrl: string;

  test.before(async () => {
    const port = await getFreePort();
    stateFile = tempStateFile();
    child = await startServer(port, stateFile);
    serverUrl = `http://127.0.0.1:${port}`;
  });

  test.after(() => stopServer(child, stateFile));

  test("mount() writes devicesUrl and bridgeUrl to mock config", async () => {
    const client = BleTestClient.connectTo(serverUrl);
    await client.mount({ dir: FIXTURES_DIR, label: "mc-test" });

    const cfg = getMockConfig();
    assert.ok(cfg !== null, "mock config should be populated after mount");
    assert.ok(
      cfg.devicesUrl.includes("/ns/"),
      `devicesUrl should contain /ns/: ${cfg.devicesUrl}`,
    );
    assert.ok(
      cfg.bridgeUrl.startsWith("ws://"),
      `bridgeUrl should be a ws:// URL: ${cfg.bridgeUrl}`,
    );
    assert.ok(
      cfg.bridgeUrl.endsWith("/:id"),
      `bridgeUrl should end with /:id: ${cfg.bridgeUrl}`,
    );
  });

  test("mock config URLs match the namespace returned by mount()", async () => {
    const client = BleTestClient.connectTo(serverUrl);
    const ns = await client.mount({ dir: FIXTURES_DIR, label: "mc-match" });

    const cfg = getMockConfig()!;
    assert.ok(
      cfg.devicesUrl.includes(ns.token),
      `devicesUrl should contain namespace token ${ns.token}`,
    );
    assert.ok(
      cfg.bridgeUrl.includes(ns.token),
      `bridgeUrl should contain namespace token ${ns.token}`,
    );

    await client.unmount(ns);
  });

});

// ── Why the mock must not call /mount in Jest mode ────────────────────────────
//
// Namespaces.create() is idempotent by dir hash but always overwrites label and
// disableAutoTick. If the mock called /mount after the test client already set
// disableAutoTick: true, the flag would be silently reset to false.

test("Namespaces.create() second call without disableAutoTick resets the flag", async (t) => {
  const ns1 = await app.models.namespaces.create(FIXTURES_DIR, "test-client-side", true);
  t.after(() => app.models.namespaces.destroy(ns1.token));

  assert.equal(ns1.disableAutoTick, true);

  // Simulate what the mock used to do: /mount with only dir+label, no disableAutoTick.
  const ns2 = await app.models.namespaces.create(FIXTURES_DIR, "mock-side");
  assert.equal(ns2.token, ns1.token, "same dir → same namespace");
  assert.equal(
    ns2.disableAutoTick,
    false,
    "second create() without disableAutoTick silently resets the flag to false",
  );
});
