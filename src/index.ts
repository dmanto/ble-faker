import mojo, { Logger, type MojoApp } from "@mojojs/core";
import { registerPlugins } from "./plugins.js";

export const app: MojoApp = mojo();
app.log.formatter = Logger.systemdFormatter;
app.log.level = "trace";
app.plugin(registerPlugins);
// const pgDSN = {connectionString: process.env.TEST_ONLINE ?? app.config.pg[app.mode]};
app.config.version = JSON.parse(
  app.home.child("package.json").readFileSync().toString(),
).version;

app.get("/", async (ctx) => {
  await ctx.render({ json: { version: app.config.version, dir: app.config.mocksDir } });
});

void app.start();
