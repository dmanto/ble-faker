import mojo, { Logger, type MojoApp } from "@mojojs/core";
import { registerPlugins } from "./plugins.js";
import fs from "node:fs";
import { STATE_FILE } from "./server-control.js";
import Namespaces from "./models/namespaces.js";

export const app: MojoApp = mojo({ mode: "production" });
app.log.formatter = Logger.systemdFormatter;
app.log.level = "trace";
app.plugin(registerPlugins);
app.config.version = JSON.parse(
  app.home.child("package.json").readFileSync().toString(),
).version;

app.get("/").to("root#index").name("index_root");
app.post("/mount").to("namespaces#store").name("store_namespace");

const nsRoutes = app.under("/ns/:token").to("namespaces#load");
nsRoutes.get("/").name("show_namespace").to("namespaces#show");
nsRoutes.get("/devices").name("index_device").to("devices#index");
nsRoutes
  .websocket("/bridge/:id")
  .name("connect_ble_bridge")
  .to("ble-bridge#connect");
nsRoutes
  .websocket("/browser/:id")
  .name("connect_browser_bridge")
  .to("browser-bridge#connect");
nsRoutes.delete("/").name("remove_namespace").to("namespaces#remove");
nsRoutes.post("/test/:id").name("post_test_input").to("test-bridge#input");
nsRoutes
  .post("/test/:id/tickN")
  .name("post_test_tickn")
  .to("test-bridge#tickN");
nsRoutes
  .post("/test/:id/disconnect")
  .name("post_test_disconnect")
  .to("test-bridge#disconnect");
nsRoutes.get("/test/:id").name("get_test_output").to("test-bridge#output");
nsRoutes.get("/test/:id/char").name("get_test_char").to("test-bridge#char");

app.models.namespaces = new Namespaces();

app.onStart(async () => {
  const port = app.config.port as number | undefined;
  if (port !== undefined) {
    const url = `http://127.0.0.1:${port}`;
    fs.writeFileSync(
      STATE_FILE,
      JSON.stringify({ pid: process.pid, url, port }),
    );
  }
});

app.onStop(async () => {
  if (app.config.port !== undefined) {
    try {
      fs.unlinkSync(STATE_FILE);
    } catch {}
  }
});

void app.start();

export { bleMockServer, STATE_FILE } from "./server-control.js";
export type { MountResult } from "./server-control.js";
export { Store, sanitizeDeviceId } from "./models/store.js";
export {
  applyCommands,
  initDeviceState,
  emptyDeviceState,
} from "./state-engine.js";
export { GATT_LABELS } from "./gatt-labels.js";
export { DEFAULT_DEVICE_CODE } from "./default-device.js";
export type { DeviceState, DeviceEntry, UiControl } from "./models/store.js";
export type { Namespace, NamespaceSummary } from "./models/namespaces.js";
export type { ApplyResult } from "./state-engine.js";
export type { DeviceEvent } from "./plugins.js";
