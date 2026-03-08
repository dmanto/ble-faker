import type { MojoContext } from "@mojojs/core";

export default class RootController {
  async index(ctx: MojoContext): Promise<void> {
    await ctx.render({}, { namespaces: ctx.models.namespaces.all() });
  }
}
