import type { MojoContext } from "@mojojs/core";
import type { Namespace } from "../models/namespaces.js";

export default class NamespacesController {
  async load(ctx: MojoContext): Promise<boolean> {
    const token = String(ctx.stash["token"] ?? "");
    const namespace = ctx.models.namespaces.get(token);
    if (namespace === undefined) {
      await ctx.notFound();
      return false;
    }
    ctx.stash["ns"] = namespace;
    return true;
  }

  async store(ctx: MojoContext): Promise<void> {
    const params = await ctx.params();
    const dir = String(params.get("dir") ?? "./mocks");
    const label = String(params.get("label") ?? dir);
    const ns = await ctx.models.namespaces.create(dir, label);
    await ctx.render({
      json: {
        token: ns.token,
        label: ns.label,
        devicesUrl: ctx.urlFor("index_device", {
          values: { token: ns.token },
          absolute: true,
        }),
        bridgeUrl: ctx.urlFor("connect_ble_bridge", {
          values: { token: ns.token, id: ":id" },
          absolute: true,
        }),
        browserUrl: ctx.urlFor("connect_browser_bridge", {
          values: { token: ns.token, id: ":id" },
          absolute: true,
        }),
      },
    });
  }

  async show(ctx: MojoContext): Promise<void> {
    const ns = ctx.stash["ns"] as Namespace;
    const devices = ns.store.all().map((entry) => ({
      id: entry.id,
      name: String(entry.state.dev.name ?? entry.id),
      wsUrl: ctx.urlFor("connect_browser_bridge", {
        values: { token: ns.token, id: entry.id },
        absolute: true,
      }),
    }));
    await ctx.render({}, { ns, devices, title: ns.label });
  }

  async remove(ctx: MojoContext): Promise<void> {
    const ns = ctx.stash["ns"] as Namespace;
    await ctx.models.namespaces.destroy(ns.token);
    await ctx.render({ text: "", status: 204 });
  }
}
