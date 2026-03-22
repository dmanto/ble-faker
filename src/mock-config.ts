/**
 * Shared configuration channel between ble-faker/test and ble-faker/mock.
 *
 * Both dist/test-client.js and dist/mock.js import this file as a separate
 * module reference (not inlined by rollup, since mock-config is its own entry
 * point). Jest's module cache guarantees a single instance per test file run,
 * so a plain module-level variable is sufficient and reliable.
 */

interface MockConfig {
  devicesUrl: string;
  bridgeUrl: string;
}

let _config: MockConfig | null = null;

export function setMockConfig(cfg: MockConfig): void {
  _config = cfg;
}

export function getMockConfig(): MockConfig | null {
  return _config;
}
