import type { MojoContext } from "@mojojs/core";
import { applyCommands } from "../state-engine.js";
import { readDeviceCode } from "../read-device-code.js";
import type { Namespace } from "../models/namespaces.js";

export default class DevicesController {
  async index(ctx: MojoContext): Promise<void> {
    const { store } = ctx.stash["ns"] as Namespace;
    const devices = store.all().map((entry) => {
      const code = readDeviceCode(entry.jsFilePath);
      const out = ctx.runDeviceLogic(code, entry.state, { kind: "advertise" });
      const { state: newState } = applyCommands(out.result, entry.state);
      entry.state = newState;
      if (!("rssi" in entry.state.dev)) entry.state.dev.rssi = -65;
      return entry.state.dev;
    });
    await ctx.render({ json: devices });
  }
}
