import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const STATE_FILE =
  process.env.BLE_FAKER_STATE ??
  path.join(os.homedir(), ".ble-faker-server.json");

// Locate dist/bin.js alongside this module at runtime.
// We deliberately avoid `new URL("./bin.js", import.meta.url)` because Vite
// intercepts that pattern in library builds and inlines the file as a data URL.
const BIN_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "bin.js",
);

interface ServerState {
  pid: number;
  url: string;
  port: number;
}

export interface MountResult {
  token: string;
  label: string;
  devicesUrl: string;
  bridgeUrl: string;
  browserUrl: string;
}

let child: ChildProcess | null = null;

async function start({ port = 3000 }: { port?: number } = {}): Promise<void> {
  // Spawn node directly — avoids npx startup overhead (10-20s on Windows).
  const spawnOptions =
    process.platform === "win32"
      ? { stdio: "ignore" as const }
      : { stdio: "ignore" as const, detached: true };
  child = spawn(
    process.execPath,
    [BIN_PATH, "--port", String(port)],
    spawnOptions,
  );
  child.unref();

  const url = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      // Wait for both the HTTP server and the state file — the onStart hook
      // that writes the state file may fire slightly after the first HTTP
      // response, so we poll both conditions together.
      if (res.ok && fs.existsSync(STATE_FILE)) return;
    } catch {}
    await new Promise<void>((r) => setTimeout(r, 200));
  }
  throw new Error("ble-faker server did not start within 30s");
}

function stop(): void {
  // Try the tracked child first; fall back to state file so stop() works
  // even when the server was started externally (e.g. via `npx ble-faker`).
  const pid = child?.pid ?? readStatePid();
  if (pid === undefined) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/F", "/T", "/PID", String(pid)], { stdio: "ignore" });
  } else {
    try {
      process.kill(-pid, "SIGTERM");
    } catch {}
  }
  child = null;
}

function readStatePid(): number | undefined {
  try {
    return (JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) as ServerState).pid;
  } catch {
    return undefined;
  }
}

async function serverUrl(): Promise<string> {
  const state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) as ServerState;
  return state.url;
}

async function get(): Promise<string> {
  const url = await serverUrl();
  const res = await fetch(url);
  return res.text();
}

async function mount({
  dir = "./mocks",
  label,
}: { dir?: string; label?: string } = {}): Promise<MountResult> {
  const url = await serverUrl();
  const body = new URLSearchParams({ dir, label: label ?? dir });
  const res = await fetch(`${url}/mount`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  return res.json() as Promise<MountResult>;
}

async function unmount(token: string): Promise<void> {
  const url = await serverUrl();
  await fetch(`${url}/ns/${token}`, { method: "DELETE" });
}

export const bleMockServer = { start, stop, get, mount, unmount };
