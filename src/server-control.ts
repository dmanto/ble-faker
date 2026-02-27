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
  const [cmd, args] =
    process.platform === "win32"
      ? ([
          "cmd",
          ["/c", "npx", ".", "--dir", dir, "--port", String(port)],
        ] as const)
      : (["npx", [".", "--dir", dir, "--port", String(port)]] as const);
  child = spawn(cmd, [...args], { stdio: "pipe" });

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
  child?.kill();
  child = null;
}

async function get(): Promise<unknown> {
  const state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) as ServerState;
  const res = await fetch(state.url);
  return res.json();
}

export const bleMockServer = { start, stop, get };
