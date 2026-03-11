import type { MojoContext } from "@mojojs/core";
import { applyCommands } from "../state-engine.js";
import { readDeviceCode } from "../read-device-code.js";
import type { DeviceEvent } from "../plugins.js";
import type { Namespace } from "../models/namespaces.js";

const TICK_MS = 1000;

export default class BleBridgeController {
  async connect(ctx: MojoContext): Promise<void> {
    const { store } = ctx.stash["ns"] as Namespace;
    const id = String(ctx.stash["id"] ?? "");
    const entry = store.get(id);
    if (entry === undefined) {
      await ctx.notFound();
      return;
    }

    ctx.json(async (ws) => {
      const runEvent = (event: DeviceEvent): void => {
        const out = ctx.runDeviceLogic(
          readDeviceCode(entry.jsFilePath),
          entry.state,
          event,
        );
        for (const { level, message } of out.logs) {
          if (level === "error")
            ctx.log.error(`[device:${entry.id}] ${message}`);
          else if (level === "warn")
            ctx.log.warn(`[device:${entry.id}] ${message}`);
          else ctx.log.info(`[device:${entry.id}] ${message}`);
        }
        const applied = applyCommands(out.result, entry.state);
        for (const [uuid, value] of applied.charUpdates) {
          ws.send({ type: "char", uuid, value }).catch(() => {});
        }
        entry.state = applied.state;
        for (const msg of applied.wsMessages) {
          entry.events.emit("set", msg);
        }
        for (const msg of applied.bridgeMessages) {
          ws.send(msg).catch(() => {});
          if (msg["type"] === "disconnect") {
            ws.close();
            return;
          }
        }
      };

      // Let device logic react to the new connection (session state, UI tweaks, etc.).
      runEvent({ kind: "connect" });
      entry.events.emit("ui", entry.state.ui);

      const ticker = setInterval(() => runEvent({ kind: "tick" }), TICK_MS);
      ticker.unref();

      // On file change the watcher re-runs start and emits "reload".
      // Push the refreshed chars to the connected app.
      const onReload = () => {
        for (const [uuid, val] of Object.entries(entry.state.chars)) {
          if (val !== "")
            ws.send({ type: "char", uuid, value: val }).catch(() => {});
        }
        entry.events.emit("ui", entry.state.ui);
      };
      entry.events.on("reload", onReload);

      const onInput = ({
        id: fieldId,
        payload,
      }: {
        id: string;
        payload: string;
      }) => runEvent({ kind: "input", id: fieldId, payload });
      entry.events.on("input", onInput);

      const onRemove = () => ws.close();
      entry.events.once("remove", onRemove);

      for await (const msg of ws) {
        if (typeof msg !== "object" || msg === null) continue;
        const { uuid = "", payload = "" } = msg as Record<string, string>;
        runEvent({ kind: "notify", uuid, payload });
      }

      clearInterval(ticker);
      entry.events.off("reload", onReload);
      entry.events.off("input", onInput);
      entry.events.off("remove", onRemove);

      // WS is closed — run disconnect so device logic can clean up state.vars.
      // Char/bridge messages have nowhere to go but vars updates still persist.
      runEvent({ kind: "disconnect" });
    });
  }
}
