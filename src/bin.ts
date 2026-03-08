import { app } from "./index.js";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { STATE_FILE } from "./server-control.js";

const usage = `Usage: ble-faker [OPTIONS]
       ble-faker stop

  npx ble-faker --port 58083
  npx ble-faker -p 3000 --level trace
  npx ble-faker stop

Commands:
  stop                Gracefully stop the running ble-faker server

Options:
  -p, --port <port>   Port to listen on, defaults to 3000
  -h, --help          Show this help

Additional mojo.js server options (--level, --cluster, etc.) are passed through.
`;

const args = process.argv.slice(2);

// Handle stop subcommand before anything else.
if (args[0] === "stop") {
  try {
    const state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) as {
      pid: number;
    };
    if (process.platform === "win32") {
      spawn("taskkill", ["/F", "/T", "/PID", String(state.pid)], {
        stdio: "ignore",
      });
    } else {
      process.kill(state.pid, "SIGTERM");
    }
    process.stdout.write(`ble-faker: sent SIGTERM to pid ${state.pid}\n`);
  } catch {
    process.stderr.write(
      "ble-faker: no running server found (state file missing or unreadable)\n",
    );
    process.exit(1);
  }
  process.exit(0);
}

let port = "3000";
const serverArgs: string[] = [];

let i = 0;
while (i < args.length) {
  const arg = args[i]!;
  if ((arg === "--port" || arg === "-p") && i + 1 < args.length) {
    port = args[++i]!;
  } else if (arg === "--help" || arg === "-h") {
    process.stdout.write(usage);
    process.exit(0);
  } else {
    serverArgs.push(arg);
  }
  i++;
}

// Clean up state file on crashes and Ctrl+C.
// SIGTERM is already handled by mojo's onStop hook.
// SIGKILL cannot be intercepted — the PID liveness check in server-control.ts covers that.
function cleanup() {
  try {
    fs.unlinkSync(STATE_FILE);
  } catch {}
}
process.on("exit", cleanup);
process.on("SIGINT", () => {
  cleanup();
  process.exit(0);
});

if (serverArgs.includes("--cluster")) {
  process.stderr.write(
    "ble-faker: --cluster is not supported (device state is in-process memory)\n",
  );
  process.exit(1);
}

app.config.port = parseInt(port, 10);
void app.cli.start("server", "-l", `http://*:${port}`, ...serverArgs);
