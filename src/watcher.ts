import { watch, type FSWatcher } from "chokidar";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import type { DeviceEntry, Store } from "./models/store.js";
import { sanitizeDeviceId } from "./models/store.js";
import { applyCommands, initDeviceState } from "./state-engine.js";
import { runDeviceLogic } from "./plugins.js";
import { readDeviceCode } from "./read-device-code.js";

export function startWatcher(mocksDir: string, store: Store): FSWatcher {
  const absDir = path.resolve(mocksDir);

  // Initial synchronous scan — populate store before the server accepts connections.
  try {
    const categories = fs.readdirSync(absDir, { withFileTypes: true });
    for (const cat of categories) {
      if (!cat.isDirectory()) continue;
      const categoryDir = path.join(absDir, cat.name);
      if (!fs.existsSync(path.join(categoryDir, "gatt-profile.json"))) continue;
      const files = fs.readdirSync(categoryDir, { withFileTypes: true });
      for (const file of files) {
        if (file.isFile() && file.name.endsWith(".js")) {
          addDevice(path.join(categoryDir, file.name), categoryDir, store);
        }
      }
    }
  } catch {
    // mocksDir may not exist yet — that's fine
  }

  const watcher = watch(absDir, { ignoreInitial: true, depth: 2 });

  watcher
    .on("add", (filePath: string) => {
      if (!filePath.endsWith(".js")) return;
      const categoryDir = path.dirname(filePath);
      if (!fs.existsSync(path.join(categoryDir, "gatt-profile.json"))) return;
      addDevice(filePath, categoryDir, store);
    })
    .on("change", (filePath: string) => {
      if (!filePath.endsWith(".js")) return;
      const id = sanitizeDeviceId(path.basename(filePath, ".js"));
      const entry = store.get(id);
      if (!entry) return;
      // File changed = device reboot: reset state and re-run start.
      entry.state = initDeviceState(entry.categoryDir);
      entry.state.dev["id"] = id;
      runStartForEntry(entry);
      entry.events.emit("reload"); // tell connected bridges to push updated chars
    })
    .on("unlink", (filePath: string) => {
      if (!filePath.endsWith(".js")) return;
      const id = sanitizeDeviceId(path.basename(filePath, ".js"));
      const entry = store.get(id);
      if (!entry) return;
      entry.events.emit("remove");
      store.remove(id);
    });

  return watcher;
}

const MAC_RE = /^[0-9a-f]{2}(-[0-9a-f]{2}){5}$/;

function addDevice(
  jsFilePath: string,
  categoryDir: string,
  store: Store,
): void {
  const id = sanitizeDeviceId(path.basename(jsFilePath, ".js"));
  if (!MAC_RE.test(id)) return;
  if (store.has(id)) return;
  const state = initDeviceState(categoryDir);
  state.dev["id"] = id;
  const entry: DeviceEntry = {
    id,
    categoryDir,
    jsFilePath,
    state,
    events: new EventEmitter(),
  };
  store.add(entry);
  runStartForEntry(entry);
}

/**
 * Run the `start` device event and apply all results (vars, ui, dev, chars)
 * to the entry's state. Also runs `advertise` to populate the device name/rssi.
 * Called on device first-add and on file change (device reboot).
 */
function runStartForEntry(entry: DeviceEntry): void {
  const code = readDeviceCode(entry.jsFilePath);
  const { state: startState } = applyCommands(
    runDeviceLogic(code, entry.state, { kind: "start" }).result,
    entry.state,
  );
  entry.state = startState;
  const { state: advState } = applyCommands(
    runDeviceLogic(code, entry.state, { kind: "advertise" }).result,
    entry.state,
  );
  entry.state.dev = advState.dev;
  if (!("rssi" in entry.state.dev)) entry.state.dev.rssi = -65;
}
