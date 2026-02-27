import { app } from "./index.js";

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

app.config.mocksDir = dir;
void app.cli.start("server", "-l", `http://*:${port}`, ...serverArgs);
