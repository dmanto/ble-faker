import type { MojoContext } from "@mojojs/core";

export default class BrowserBridgeController {
  async connect(ctx: MojoContext): Promise<void> {
    const id = String(ctx.stash["id"] ?? "");
    const entry = ctx.models.store.get(id);
    if (entry === undefined) {
      await ctx.notFound();
      return;
    }

    ctx.json(async (ws) => {
      ws.send({ type: "ui", ui: entry.state.ui }).catch(() => {});

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

      const onRemove = () => ws.close();
      entry.events.once("remove", onRemove);

      for await (const msg of ws) {
        if (typeof msg !== "object" || msg === null) continue;
        const { type, id = "", payload = "" } = msg as Record<string, string>;
        if (type === "input") entry.events.emit("input", { id, payload });
      }

      entry.events.off("set", onSet);
      entry.events.off("ui", onUi);
      entry.events.off("remove", onRemove);
    });
  }
}
