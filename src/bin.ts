import { app } from "./index.js";
import fs from "node:fs";
import { STATE_FILE } from "./server-control.js";

const usage = `Usage: ble-faker [OPTIONS]

  npx ble-faker --dir ./ble-specs --port 58083
  npx ble-faker -d ./mocks -p 3000 --level trace

Options:
  -d, --dir <path>    Path to mock files directory, defaults to "./mocks"
  -p, --port <port>   Port to listen on, defaults to 3000
  -h, --help          Show this help

Additional mojo.js server options (--level, --cluster, etc.) are passed through.
`;

const args = process.argv.slice(2);
let dir = "./mocks";
let port = "3000";
const serverArgs: string[] = [];

let i = 0;
while (i < args.length) {
  const arg = args[i]!;
  if ((arg === "--dir" || arg === "-d") && i + 1 < args.length) {
    dir = args[++i]!;
  } else if ((arg === "--port" || arg === "-p") && i + 1 < args.length) {
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

if (serverArgs.includes('--cluster')) {
  process.stderr.write('ble-faker: --cluster is not supported (device state is in-process memory)\n');
  process.exit(1);
}

app.config.mocksDir = dir;
app.config.port = parseInt(port, 10);
void app.cli.start("server", "-l", `http://*:${port}`, ...serverArgs);
