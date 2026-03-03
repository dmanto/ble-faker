import type { MojoContext } from "@mojojs/core";
import { applyCommands } from "../state-engine.js";
import { readDeviceCode } from "../read-device-code.js";

export default class DevicesController {
  async list(ctx: MojoContext): Promise<void> {
    const devices = ctx.models.store.all().map((entry) => {
      const code = readDeviceCode(entry.jsFilePath);
      const out = ctx.runDeviceLogic(code, entry.state, { kind: "advertise" });
      const dev = applyCommands(out.result, entry.state).state.dev;
      if (!("rssi" in dev)) dev.rssi = -65;
      return dev;
    });
    await ctx.render({ json: devices });
  }
}
