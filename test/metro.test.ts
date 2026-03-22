import test, { suite } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

// metro.cjs is CommonJS — use createRequire to load it from this ESM test file.
const cjsRequire = createRequire(import.meta.url);

// Regression guard: loading the module used to throw
//   TypeError: The "path" argument must be of type string. Received undefined
// because rollup's CJS conversion of `import.meta.url` produced `({}).url`
// (undefined) instead of the proper __dirname-based path.
// This suite would fail at the very first require() call with the old code.

suite("withBleFaker metro helper", () => {
  // Cache the module once — all tests share the same CJS instance.
  const { withBleFaker } = cjsRequire("../dist/metro.cjs") as {
    withBleFaker: (config: Record<string, unknown>, opts: { dir: string; label?: string; port?: number; env?: string }) => Record<string, unknown>;
  };

  test("module loads without throwing (regression: __dirname vs import.meta.url)", () => {
    // If we got this far, the module loaded successfully.
    assert.equal(typeof withBleFaker, "function");
  });

  test("no-op when activation env var is not set", () => {
    const saved = process.env.BLE_MOCK;
    delete process.env.BLE_MOCK;
    try {
      const config = { resolver: {}, server: {} };
      const result = withBleFaker(config, { dir: "/tmp/mocks" });
      assert.equal(result, config, "should return the identical config object");
    } finally {
      if (saved !== undefined) process.env.BLE_MOCK = saved;
    }
  });

  test("no-op respects a custom env var name", () => {
    delete process.env.MY_MOCK;
    const config = { resolver: {}, server: {} };
    const result = withBleFaker(config, { dir: "/tmp/mocks", env: "MY_MOCK" });
    assert.equal(result, config);
  });

  test("modifies config when BLE_MOCK=true", () => {
    process.env.BLE_MOCK = "true";
    try {
      const config = { resolver: {}, server: {}, watchFolders: [] as string[] };
      const result = withBleFaker(config, { dir: "/tmp/mocks", label: "test", port: 9999 });

      assert.notEqual(result, config, "should return a new config object");
      assert.ok(
        Array.isArray(result.watchFolders),
        "watchFolders should be an array",
      );
      assert.ok(
        (result.watchFolders as string[]).some((p) => p.endsWith("ble-faker")),
        "watchFolders should include the ble-faker package root",
      );
      assert.equal(
        typeof (result.resolver as Record<string, unknown>).resolveRequest,
        "function",
        "resolveRequest should be added to resolver",
      );
      assert.equal(
        typeof (result.server as Record<string, unknown>).enhanceMiddleware,
        "function",
        "enhanceMiddleware should be added to server",
      );
    } finally {
      delete process.env.BLE_MOCK;
    }
  });

  test("resolveRequest redirects react-native-ble-plx to ble-faker mock.js", () => {
    process.env.BLE_MOCK = "true";
    try {
      const config = { resolver: {}, server: {} };
      const result = withBleFaker(config, { dir: "/tmp/mocks" });

      const resolve = (result.resolver as Record<string, unknown>)
        .resolveRequest as (ctx: object, name: string, platform: string) => { filePath: string; type: string };

      const fakeContext = {
        originModulePath: "/project/App.tsx",
        resolveRequest: () => { throw new Error("should not be called"); },
      };

      const resolution = resolve(fakeContext, "react-native-ble-plx", "ios");
      assert.ok(
        resolution.filePath.endsWith(path.join("dist", "mock.js")),
        `filePath should end with dist/mock.js, got: ${resolution.filePath}`,
      );
      assert.equal(resolution.type, "sourceFile");
    } finally {
      delete process.env.BLE_MOCK;
    }
  });

  test("resolveRequest falls through for other modules", () => {
    process.env.BLE_MOCK = "true";
    try {
      const config = { resolver: {}, server: {} };
      const result = withBleFaker(config, { dir: "/tmp/mocks" });

      const resolve = (result.resolver as Record<string, unknown>)
        .resolveRequest as (ctx: object, name: string, platform: string) => unknown;

      let called = false;
      const fakeContext = {
        originModulePath: "/project/App.tsx",
        resolveRequest: (_ctx: unknown, name: string) => {
          called = true;
          return { filePath: `/resolved/${name}`, type: "sourceFile" };
        },
      };

      const resolution = resolve(fakeContext, "some-other-module", "ios") as { filePath: string };
      assert.ok(called, "should delegate to context.resolveRequest for non-ble-plx modules");
      assert.equal(resolution.filePath, "/resolved/some-other-module");
    } finally {
      delete process.env.BLE_MOCK;
    }
  });

  test("enhanceMiddleware serves /ble-faker-config with correct payload", () => {
    process.env.BLE_MOCK = "true";
    try {
      const config = { resolver: {}, server: {} };
      const result = withBleFaker(config, {
        dir: "/tmp/mocks",
        label: "test-label",
        port: 9999,
      });

      const enhance = (result.server as Record<string, unknown>)
        .enhanceMiddleware as (mw: unknown) => (req: object, res: object, next: () => void) => void;

      const handler = enhance(() => { throw new Error("inner middleware should not be called"); });

      const headers: Record<string, string> = {};
      let body = "";
      handler(
        { url: "/ble-faker-config" },
        {
          setHeader: (k: string, v: string) => { headers[k] = v; },
          end: (b: string) => { body = b; },
        },
        () => { throw new Error("next() should not be called for /ble-faker-config"); },
      );

      assert.equal(headers["Content-Type"], "application/json");
      const parsed = JSON.parse(body) as { port: number; label: string; dir: string };
      assert.equal(parsed.port, 9999);
      assert.equal(parsed.label, "test-label");
      assert.ok(parsed.dir.endsWith("mocks"), `dir should end with mocks, got: ${parsed.dir}`);
    } finally {
      delete process.env.BLE_MOCK;
    }
  });

  test("enhanceMiddleware delegates non-config routes to inner middleware", () => {
    process.env.BLE_MOCK = "true";
    try {
      const config = { resolver: {}, server: {} };
      const result = withBleFaker(config, { dir: "/tmp/mocks", port: 9999 });

      const enhance = (result.server as Record<string, unknown>)
        .enhanceMiddleware as (mw: unknown) => (req: object, res: object, next: () => void) => void;

      let delegated = false;
      const handler = enhance((req: unknown, _res: unknown, next: () => void) => {
        delegated = true;
        next();
      });

      let nextCalled = false;
      handler(
        { url: "/some/other/route" },
        {},
        () => { nextCalled = true; },
      );

      assert.ok(delegated, "inner middleware should be called for non-config routes");
      assert.ok(nextCalled, "next() should be called through the middleware chain");
    } finally {
      delete process.env.BLE_MOCK;
    }
  });
});
