import mojo, { Logger, type MojoApp } from "@mojojs/core";
import { registerPlugins } from "./plugins.js";
import fs from "node:fs";
import { STATE_FILE } from "./server-control.js";
import { Store } from "./models/store.js";

export const app: MojoApp = mojo();
app.log.formatter = Logger.systemdFormatter;
app.log.level = "trace";
app.plugin(registerPlugins);
// const pgDSN = {connectionString: process.env.TEST_ONLINE ?? app.config.pg[app.mode]};
app.config.version = JSON.parse(
  app.home.child("package.json").readFileSync().toString(),
).version;

app.get("/", async (ctx) => {
  await ctx.render({
    json: { version: app.config.version, dir: app.config.mocksDir },
  });
});

app.onStart(async () => {
  app.models.store = new Store();
  const port = (app.config.port as number | undefined) ?? 3000;
  const url = `http://127.0.0.1:${port}`;
  fs.writeFileSync(STATE_FILE, JSON.stringify({ pid: process.pid, url, port }));
});

app.onStop(async () => {
  try {
    fs.unlinkSync(STATE_FILE);
  } catch {}
});

void app.start();

export { bleMockServer } from "./server-control.js";
export { Store, sanitizeDeviceId } from "./models/store.js";
export { applyCommands, initDeviceState, emptyDeviceState } from "./state-engine.js";
export { GATT_LABELS } from "./gatt-labels.js";
export { DEFAULT_DEVICE_CODE } from "./default-device.js";
export type { DeviceState, DeviceEntry, UiControl } from "./models/store.js";
export type { ApplyResult } from "./state-engine.js";
