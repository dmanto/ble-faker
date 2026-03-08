import crypto from "node:crypto";
import path from "node:path";
import type { FSWatcher } from "chokidar";
import { Store } from "./store.js";
import { startWatcher } from "../watcher.js";

export interface Namespace {
  token: string;
  label: string;
  dir: string;
  store: Store;
  watcher: FSWatcher;
}

export interface NamespaceSummary {
  token: string;
  label: string;
  dir: string;
}

export default class Namespaces {
  private _map = new Map<string, Namespace>();

  async create(dir: string, label: string): Promise<Namespace> {
    const absDir = path.resolve(dir);
    const token = crypto
      .createHash("sha1")
      .update(absDir)
      .digest("hex")
      .slice(0, 16);
    const existing = this._map.get(token);
    if (existing !== undefined) {
      existing.label = label;
      return existing;
    }
    const store = new Store();
    const watcher = startWatcher(absDir, store);
    const namespace: Namespace = { token, label, dir: absDir, store, watcher };
    this._map.set(token, namespace);
    return namespace;
  }

  get(token: string): Namespace | undefined {
    return this._map.get(token);
  }

  all(): NamespaceSummary[] {
    return Array.from(this._map.values()).map(({ token, label, dir }) => ({
      token,
      label,
      dir,
    }));
  }

  async destroy(token: string): Promise<void> {
    const ns = this._map.get(token);
    if (ns === undefined) return;
    await ns.watcher.close();
    this._map.delete(token);
  }
}

declare module "@mojojs/core" {
  interface MojoModels {
    namespaces: Namespaces;
  }
}
