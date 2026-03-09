import type { MojoContext } from "@mojojs/core";
import type { Namespace } from "../models/namespaces.js";

export default class TestBridgeController {
  async input(ctx: MojoContext): Promise<void> {
    const { store } = ctx.stash["ns"] as Namespace;
    const id = String(ctx.stash["id"] ?? "");
    const entry = store.get(id);
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

  async output(ctx: MojoContext): Promise<void> {
    const { store } = ctx.stash["ns"] as Namespace;
    const id = String(ctx.stash["id"] ?? "");
    const entry = store.get(id);
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

    let regex: RegExp;
    try {
      regex = new RegExp(expectedStr);
    } catch {
      await ctx.render({ text: "invalid expected pattern", status: 400 });
      return;
    }

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
          if (fieldName === name && regex.test(value)) {
            clearTimeout(timer);
            entry.events.off("set", onSet);
            entry.events.off("remove", onRemove);
            resolve({ name: fieldName, value });
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
      await ctx.render({ text: "", status: 408 });
    } else {
      await ctx.render({ json: result });
    }
  }
}
