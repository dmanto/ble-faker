/**
 * Metro configuration helper for ble-faker.
 *
 * Usage in metro.config.js:
 *
 *   const { getDefaultConfig } = require('expo/metro-config');
 *   const { withBleFaker } = require('ble-faker/metro');
 *
 *   const config = getDefaultConfig(__dirname);
 *   module.exports = withBleFaker(config, { dir: './mocks', label: 'My App' });
 *
 * For bare React Native projects:
 *
 *   const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
 *   const { withBleFaker } = require('ble-faker/metro');
 *
 *   module.exports = withBleFaker(mergeConfig(getDefaultConfig(__dirname), {}), {
 *     dir: './mocks',
 *     label: 'My App',
 *   });
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

// Resolve the ble-faker package root. This file is built to dist/metro.cjs,
// so one level up is the package root.
const _bleFakerRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObject = Record<string, any>;

export interface BleFakerMetroOptions {
  /**
   * Path to your mocks directory (the parent of category folders).
   * Resolved relative to process.cwd() when not absolute.
   */
  dir: string;
  /** Human-readable label shown in the browser dashboard. Defaults to 'ble-faker'. */
  label?: string;
  /**
   * Override the ble-faker server port. When omitted, the port is read from
   * ~/.ble-faker-server.json (written by `ble-faker --port <n>` on startup).
   * Falls back to 58083 if the state file is missing.
   */
  port?: number;
  /**
   * Name of the environment variable that activates the mock. Defaults to 'BLE_MOCK'.
   * The helper is a no-op unless process.env[env] === 'true'.
   * Set it in your package.json script with cross-env or directly in the shell.
   */
  env?: string;
}

/**
 * Wrap a Metro config object with ble-faker's mock redirect.
 *
 * Returns the config unchanged when the activation env var is not set,
 * so it is safe to apply unconditionally in metro.config.js.
 */
export function withBleFaker(
  config: AnyObject,
  opts: BleFakerMetroOptions,
): AnyObject {
  const envVar = opts.env ?? "BLE_MOCK";
  if (process.env[envVar] !== "true") return config;

  const mockDir = path.resolve(opts.dir);
  const mockLabel = opts.label ?? "ble-faker";

  // Determine server port: explicit override > state file > default.
  let bleFakerPort = opts.port ?? 58083;
  if (opts.port === undefined) {
    try {
      const stateFile = path.join(os.homedir(), ".ble-faker-server.json");
      const state = JSON.parse(fs.readFileSync(stateFile, "utf8")) as {
        port?: number;
      };
      if (state.port) bleFakerPort = state.port;
    } catch {}
  }

  const result: AnyObject = { ...config };

  // Let Metro watch the ble-faker package itself for any mock-related changes.
  result.watchFolders = [...(config.watchFolders ?? []), _bleFakerRoot];

  // Serve a config endpoint so the mock library can discover the server URL.
  const originalEnhance = config.server?.enhanceMiddleware as
    | ((mw: unknown) => (req: unknown, res: unknown, next: unknown) => void)
    | undefined;
  result.server = {
    ...config.server,
    enhanceMiddleware:
      (middleware: unknown) =>
      (
        req: { url?: string },
        res: {
          setHeader: (k: string, v: string) => void;
          end: (b: string) => void;
        },
        next: () => void,
      ) => {
        if (req.url === "/ble-faker-config") {
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              port: bleFakerPort,
              dir: mockDir,
              label: mockLabel,
            }),
          );
          return;
        }
        const downstream = originalEnhance
          ? originalEnhance(middleware)
          : (middleware as (req: unknown, res: unknown, next: unknown) => void);
        downstream(req, res, next);
      },
  };

  // Redirect react-native-ble-plx imports to the ble-faker mock.
  const originalResolve = config.resolver?.resolveRequest as
    | ((context: unknown, moduleName: string, platform: unknown) => unknown)
    | undefined;
  result.resolver = {
    ...config.resolver,
    resolveRequest: (
      context: {
        originModulePath: string;
        resolveRequest: (
          ctx: unknown,
          name: string,
          platform: unknown,
        ) => unknown;
      },
      moduleName: string,
      platform: unknown,
    ) => {
      if (moduleName === "react-native-ble-plx") {
        return {
          filePath: path.join(_bleFakerRoot, "dist/mock.js"),
          type: "sourceFile",
        };
      }
      // When resolving ble-faker's own internal imports, re-root the origin
      // to the project root so Metro finds packages in the app's node_modules.
      if (context.originModulePath.startsWith(_bleFakerRoot)) {
        return (originalResolve ?? context.resolveRequest)(
          { ...context, originModulePath: path.join(process.cwd(), "metro.config.js") },
          moduleName,
          platform,
        );
      }
      return (originalResolve ?? context.resolveRequest)(
        context,
        moduleName,
        platform,
      );
    },
  };

  return result;
}
