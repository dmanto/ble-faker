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
          entry.events.emit("charUpdate", { uuid, value });
        }
        entry.state = applied.state;
        for (const msg of applied.wsMessages) {
          entry.lastOutputValues[msg["fieldName"] as string] = msg[
            "value"
          ] as string;
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

      ctx.log.info(`[device:${entry.id}] bridge connected`);
      entry.bridgeOpen = true;
      entry.events.emit("bridgeConnected");

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

      const onTickN = ({ count }: { count: number }) => {
        const n = Math.max(0, Math.min(count, 100));
        for (let i = 0; i < n; i++) runEvent({ kind: "tick" });
      };
      entry.events.on("tickN", onTickN);

      const onForceDisconnect = () => {
        ctx.log.info(
          `[device:${entry.id}] ble-bridge: sending disconnect to app`,
        );
        ws.send({ type: "disconnect" }).catch(() => {});
      };
      entry.events.once("forceDisconnect", onForceDisconnect);

      const onRemove = () => ws.close();
      entry.events.once("remove", onRemove);

      for await (const msg of ws) {
        if (typeof msg !== "object" || msg === null) continue;
        const m = msg as Record<string, unknown>;
        if (m["type"] === "tickN") {
          const count = typeof m["count"] === "number" ? m["count"] : 0;
          entry.events.emit("tickN", { count });
          continue;
        }
        const { uuid = "", payload = "" } = m as Record<string, string>;
        runEvent({ kind: "notify", uuid, payload });
      }

      clearInterval(ticker);
      entry.events.off("reload", onReload);
      entry.events.off("input", onInput);
      entry.events.off("tickN", onTickN);
      entry.events.off("forceDisconnect", onForceDisconnect);
      entry.events.off("remove", onRemove);

      ctx.log.info(`[device:${entry.id}] bridge disconnected`);
      entry.bridgeOpen = false;
      entry.events.emit("bridgeDisconnected");

      // WS is closed — run disconnect so device logic can clean up state.vars.
      // Char/bridge messages have nowhere to go but vars updates still persist.
      runEvent({ kind: "disconnect" });
    });
  }
}
