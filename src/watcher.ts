import { watch, type FSWatcher } from "chokidar";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import type { Store } from "./models/store.js";
import { sanitizeDeviceId } from "./models/store.js";
import { initDeviceState } from "./state-engine.js";

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
      store.get(id)?.events.emit("reload");
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

function addDevice(
  jsFilePath: string,
  categoryDir: string,
  store: Store,
): void {
  const id = sanitizeDeviceId(path.basename(jsFilePath, ".js"));
  if (store.has(id)) return;
  const state = initDeviceState(categoryDir);
  state.dev["id"] = id;
  store.add({ id, categoryDir, jsFilePath, state, events: new EventEmitter() });
}
