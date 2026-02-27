import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const STATE_FILE = path.join(os.homedir(), ".ble-faker-server.json");

interface ServerState {
  pid: number;
  url: string;
  port: number;
}

let child: ChildProcess | null = null;

async function start({
  dir = "./mocks",
  port = 3000,
}: { dir?: string; port?: number } = {}): Promise<void> {
  const spawnOptions =
    process.platform === "win32"
      ? { shell: true, stdio: "ignore" as const }
      : { stdio: "ignore" as const, detached: true };
  child = spawn(
    "npx",
    [".", "--dir", dir, "--port", String(port)],
    spawnOptions,
  );
  child.unref();

  const url = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await new Promise<void>((r) => setTimeout(r, 200));
  }
  throw new Error("ble-faker server did not start within 10s");
}

function stop(): void {
  if (!child || child.pid === undefined) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/F", "/T", "/PID", String(child.pid)], {
      stdio: "ignore",
    });
  } else {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {}
  }
  child = null;
}

async function get(): Promise<unknown> {
  const state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) as ServerState;
  const res = await fetch(state.url);
  return res.json();
}

export const bleMockServer = { start, stop, get };
