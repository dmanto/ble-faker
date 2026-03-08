import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BIN_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../dist/bin.js",
);

let testSeq = 0;

function tempStateFile(): string {
  return path.join(
    os.tmpdir(),
    `ble-faker-test-${process.pid}-${++testSeq}.json`,
  );
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

async function startServer(
  port: number,
  stateFile: string,
): Promise<ChildProcess> {
  const child = spawn(process.execPath, [BIN_PATH, "--port", String(port)], {
    env: { ...process.env, BLE_FAKER_STATE: stateFile },
    stdio: "ignore",
  });
  const url = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return child;
    } catch {}
    await new Promise<void>((r) => setTimeout(r, 100));
  }
  child.kill();
  throw new Error(`server on port ${port} did not start within 10s`);
}

function cleanup(child: ChildProcess, stateFile: string): void {
  try {
    child.kill("SIGTERM");
  } catch {}
  try {
    fs.unlinkSync(stateFile);
  } catch {}
}

test("state file is written while server runs", async (t) => {
  const port = await getFreePort();
  const stateFile = tempStateFile();
  const child = await startServer(port, stateFile);
  t.after(() => cleanup(child, stateFile));

  const state = JSON.parse(fs.readFileSync(stateFile, "utf8")) as {
    pid: number;
    url: string;
    port: number;
  };
  assert.equal(typeof state.pid, "number");
  assert.equal(state.port, port);
  assert.ok(state.url.includes(String(port)));
});

test("stop subcommand: exits 0 and state file is removed", async (t) => {
  const port = await getFreePort();
  const stateFile = tempStateFile();
  const child = await startServer(port, stateFile);
  t.after(() => cleanup(child, stateFile));

  const exitCode = await new Promise<number>((resolve) => {
    const proc = spawn(process.execPath, [BIN_PATH, "stop"], {
      env: { ...process.env, BLE_FAKER_STATE: stateFile },
      stdio: "ignore",
    });
    proc.on("close", (code) => resolve(code ?? 1));
  });
  assert.equal(exitCode, 0);

  const deadline = Date.now() + 5_000;
  while (fs.existsSync(stateFile) && Date.now() < deadline) {
    await new Promise<void>((r) => setTimeout(r, 100));
  }
  assert.ok(!fs.existsSync(stateFile));
});
