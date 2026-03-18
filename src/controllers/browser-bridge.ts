import type { MojoContext } from "@mojojs/core";
import type { Namespace } from "../models/namespaces.js";

export default class BrowserBridgeController {
  async connect(ctx: MojoContext): Promise<void> {
    const { store } = ctx.stash["ns"] as Namespace;
    const id = String(ctx.stash["id"] ?? "");
    const entry = store.get(id);
    if (entry === undefined) {
      await ctx.notFound();
      return;
    }

    ctx.json(async (ws) => {
      ws.send({ type: "ui", ui: entry.state.ui }).catch(() => {});
      ws.send({
        type: "bridgeStatus",
        connected: entry.bridgeOpen ?? false,
      }).catch(() => {});

      const onSet = ({
        fieldName,
        value,
      }: {
        fieldName: string;
        value: string;
      }) => {
        ws.send({ type: "set", fieldName, value }).catch(() => {});
      };
      entry.events.on("set", onSet);

      const onUi = (ui: unknown) => {
        ws.send({ type: "ui", ui }).catch(() => {});
      };
      entry.events.on("ui", onUi);

      const onBridgeConnected = () => {
        ws.send({ type: "bridgeStatus", connected: true }).catch(() => {});
      };
      entry.events.on("bridgeConnected", onBridgeConnected);

      const onBridgeDisconnected = () => {
        ws.send({ type: "bridgeStatus", connected: false }).catch(() => {});
      };
      entry.events.on("bridgeDisconnected", onBridgeDisconnected);

      const onRemove = () => ws.close();
      entry.events.once("remove", onRemove);

      for await (const msg of ws) {
        if (typeof msg !== "object" || msg === null) continue;
        const {
          type,
          id = "",
          payload = "",
          count,
        } = msg as Record<string, unknown>;
        if (type === "input") {
          entry.events.emit("input", { id, payload });
        } else if (type === "tickN") {
          entry.events.emit("tickN", {
            count: typeof count === "number" ? count : Number(count) || 0,
          });
        } else if (type === "forceDisconnect") {
          if (entry.bridgeOpen) {
            ctx.log.info(
              `[device:${entry.id}] browser: forceDisconnect requested`,
            );
            entry.events.emit("forceDisconnect");
          }
        }
      }

      entry.events.off("set", onSet);
      entry.events.off("ui", onUi);
      entry.events.off("bridgeConnected", onBridgeConnected);
      entry.events.off("bridgeDisconnected", onBridgeDisconnected);
      entry.events.off("remove", onRemove);
    });
  }
}
