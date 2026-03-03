import type { MojoContext } from "@mojojs/core";
import { applyCommands } from "../state-engine.js";
import { readDeviceCode } from "../read-device-code.js";
import type { DeviceEvent } from "../plugins.js";

const TICK_MS = 1000;

export default class BleBridgeController {
  async connect(ctx: MojoContext): Promise<void> {
    const id = String(ctx.stash["id"] ?? "");
    const entry = ctx.models.store.get(id);
    if (entry === undefined) {
      await ctx.notFound();
      return;
    }

    ctx.json(async (ws) => {
      const runEvent = (event: DeviceEvent, emitUi = false): void => {
        const out = ctx.runDeviceLogic(
          readDeviceCode(entry.jsFilePath),
          entry.state,
          event,
        );
        const applied = applyCommands(out.result, entry.state);
        for (const [uuid, newVal] of Object.entries(applied.state.chars)) {
          if (newVal !== entry.state.chars[uuid]) {
            ws.send({ type: "char", uuid, value: newVal }).catch(() => {});
          }
        }
        entry.state = applied.state;
        if (emitUi) entry.events.emit("ui", entry.state.ui);
        for (const msg of applied.wsMessages) {
          entry.events.emit("set", msg);
        }
      };

      runEvent({ kind: "start" }, true);

      const ticker = setInterval(() => runEvent({ kind: "tick" }), TICK_MS);
      ticker.unref();

      const onReload = () => runEvent({ kind: "reload" }, true);
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
    });
  }
}
