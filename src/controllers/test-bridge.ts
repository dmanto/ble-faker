import type { MojoContext } from "@mojojs/core";
import type { Namespace } from "../models/namespaces.js";
import type { DeviceEntry } from "../models/store.js";

function getEntry(ctx: MojoContext): DeviceEntry | undefined {
  const { store } = ctx.stash["ns"] as Namespace;
  const id = String(ctx.stash["id"] ?? "");
  return store.get(id);
}

function parseRegex(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern);
  } catch {
    return null;
  }
}

export default class TestBridgeController {
  async input(ctx: MojoContext): Promise<void> {
    const entry = getEntry(ctx);
    if (entry === undefined) {
      await ctx.notFound();
      return;
    }

    const params = await ctx.params();
    const name = String(params.get("name") ?? "");
    const payload = String(params.get("payload") ?? "");
    entry.events.emit("input", { id: name, payload });
    await ctx.render({ text: "", status: 204 });
  }

  async tickN(ctx: MojoContext): Promise<void> {
    const entry = getEntry(ctx);
    if (entry === undefined) {
      await ctx.notFound();
      return;
    }

    const params = await ctx.params();
    const count = Math.max(
      0,
      Math.min(parseInt(String(params.get("count") ?? "1"), 10), 100),
    );
    entry.events.emit("tickN", { count });
    await ctx.render({ text: "", status: 204 });
  }

  async disconnect(ctx: MojoContext): Promise<void> {
    const entry = getEntry(ctx);
    if (entry === undefined) {
      await ctx.notFound();
      return;
    }

    entry.events.emit("forceDisconnect");
    await ctx.render({ text: "", status: 204 });
  }

  async output(ctx: MojoContext): Promise<void> {
    const entry = getEntry(ctx);
    if (entry === undefined) {
      await ctx.notFound();
      return;
    }

    const params = await ctx.params();
    const name = String(params.get("name") ?? "");
    const expectedStr = String(params.get("expected") ?? "");
    const timeoutMs = Math.max(
      0,
      parseInt(String(params.get("timeout") ?? "5000"), 10),
    );

    const regex = parseRegex(expectedStr);
    if (regex === null) {
      await ctx.render({ text: "invalid expected pattern", status: 400 });
      return;
    }

    // Check current value immediately before waiting.
    const current = entry.lastOutputValues[name];
    if (current !== undefined && regex.test(current)) {
      await ctx.render({ json: { name, value: current } });
      return;
    }

    let lastSeen: string | null = current ?? null;

    const result = await new Promise<{ name: string; value: string } | null>(
      (resolve) => {
        const onRemove = () => {
          clearTimeout(timer);
          entry.events.off("set", onSet);
          resolve(null);
        };

        const onSet = ({
          fieldName,
          value,
        }: {
          fieldName: string;
          value: string;
        }) => {
          if (fieldName === name) {
            lastSeen = value;
            if (regex.test(value)) {
              clearTimeout(timer);
              entry.events.off("set", onSet);
              entry.events.off("remove", onRemove);
              resolve({ name: fieldName, value });
            }
          }
        };

        const timer = setTimeout(() => {
          entry.events.off("set", onSet);
          entry.events.off("remove", onRemove);
          resolve(null);
        }, timeoutMs);

        entry.events.on("set", onSet);
        entry.events.once("remove", onRemove);
      },
    );

    if (result === null) {
      await ctx.render({ json: { lastSeen }, status: 408 });
    } else {
      await ctx.render({ json: result });
    }
  }

  async char(ctx: MojoContext): Promise<void> {
    const entry = getEntry(ctx);
    if (entry === undefined) {
      await ctx.notFound();
      return;
    }

    const params = await ctx.params();
    const uuid = String(params.get("uuid") ?? "").toLowerCase();
    const expectedStr = String(params.get("expected") ?? "");
    const timeoutMs = Math.max(
      0,
      parseInt(String(params.get("timeout") ?? "5000"), 10),
    );

    const regex = parseRegex(expectedStr);
    if (regex === null) {
      await ctx.render({ text: "invalid expected pattern", status: 400 });
      return;
    }

    // Check current char value immediately before waiting.
    const current = entry.state.chars[uuid];
    if (current !== undefined && regex.test(current)) {
      await ctx.render({ json: { uuid, value: current } });
      return;
    }

    let lastSeen: string | null = current ?? null;

    const result = await new Promise<{ uuid: string; value: string } | null>(
      (resolve) => {
        const onRemove = () => {
          clearTimeout(timer);
          entry.events.off("charUpdate", onCharUpdate);
          resolve(null);
        };

        const onCharUpdate = ({
          uuid: u,
          value,
        }: {
          uuid: string;
          value: string;
        }) => {
          if (u === uuid) {
            lastSeen = value;
            if (regex.test(value)) {
              clearTimeout(timer);
              entry.events.off("charUpdate", onCharUpdate);
              entry.events.off("remove", onRemove);
              resolve({ uuid, value });
            }
          }
        };

        const timer = setTimeout(() => {
          entry.events.off("charUpdate", onCharUpdate);
          entry.events.off("remove", onRemove);
          resolve(null);
        }, timeoutMs);

        entry.events.on("charUpdate", onCharUpdate);
        entry.events.once("remove", onRemove);
      },
    );

    if (result === null) {
      await ctx.render({ json: { lastSeen }, status: 408 });
    } else {
      await ctx.render({ json: result });
    }
  }
}
