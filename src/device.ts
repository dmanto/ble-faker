/**
 * Type declarations for ble-faker device logic files.
 *
 * Add the following header to any device .js file to enable IDE
 * autocompletion and inline docs:
 *
 * ```js
 * /// <reference types="ble-faker/device" />
 *
 * /** @type {import('ble-faker/device').DeviceLogicFn} *\/
 * export default function (state, event) {
 *   return [];
 * }
 * ```
 *
 * Note: `// @ts-check` is intentionally omitted. React Native projects
 * typically do not enable `checkJs`, so the reference and `@type` annotation
 * give full autocompletion and event/state narrowing without triggering
 * `noImplicitAny` errors on helper function parameters.
 */

// ─── State ───────────────────────────────────────────────────────────────────

export interface UiControl {
  name: string;
  label: string;
}

export interface DeviceUi {
  ins: UiControl[];
  outs: UiControl[];
}

/**
 * The runtime state passed into every device logic call.
 * All fields are **read-only** from the device code's perspective —
 * direct mutations are silently discarded.
 * Use return commands to write state (e.g. `{ vars: { key: value } }`).
 */
export interface DeviceState {
  /**
   * Full GATT profile from `gatt-profile.json`, merged with any `Partial<Device>`
   * patches returned by previous logic calls. Includes `id` (MAC with dashes),
   * `name`, `rssi`, `services`, `serviceUUIDs`, `manufacturerData`, etc.
   */
  dev: Record<string, unknown>;
  /** Arbitrary values persisted across calls via `{ vars: { … } }` commands. */
  vars: Record<string, unknown>;
  /** Current characteristic values keyed by UUID, base64-encoded. */
  chars: Record<string, string>;
  /** Current browser UI control definitions. */
  ui: DeviceUi;
}

// ─── Events ──────────────────────────────────────────────────────────────────

/**
 * Fired once when the namespace starts and again whenever the device .js file
 * changes on disk. Use this event to initialise `state.vars` — values set here
 * act as non-volatile memory (NVM) and persist across BLE reconnections until
 * the next `start` event.
 */
export type StartEvent = { kind: "start" };

/** Fired on every new BLE bridge WebSocket connection. Use for per-connection setup. */
export type ConnectEvent = { kind: "connect" };

/**
 * Fired after the BLE bridge WebSocket closes (app disconnected).
 * The app can no longer receive messages, but returned commands are still applied
 * to `state` — use `{ vars: { … } }` to persist session cleanup for the next connect.
 */
export type DisconnectEvent = { kind: "disconnect" };

/** Fired every second while a bridge WebSocket is open. */
export type TickEvent = { kind: "tick" };

/** Fired on each GET /devices request to build the advertising packet. Result is persisted. */
export type AdvertiseEvent = { kind: "advertise" };

/** Fired when the app writes a characteristic value. */
export type NotifyEvent = { kind: "notify"; uuid: string; payload: string };

/** Fired when a browser input field is submitted, or via the test HTTP API. */
export type InputEvent = { kind: "input"; id: string; payload: string };

/** Discriminated union of all event kinds passed to device logic. */
export type DeviceEvent =
  | StartEvent
  | ConnectEvent
  | DisconnectEvent
  | TickEvent
  | AdvertiseEvent
  | NotifyEvent
  | InputEvent;

// ─── Commands ─────────────────────────────────────────────────────────────────

/** Update a GATT characteristic value: `['UUID', base64EncodedValue]` */
export type CharCommand = [uuid: string, base64: string];

/** Patch `state.dev` with any advertising or device fields. */
export type DevPatchCommand = Record<string, unknown>;

/** Define browser input controls (text field + submit button per entry). */
export type InCommand = { in: UiControl[] };

/** Define browser output display fields. */
export type OutCommand = { out: UiControl[] };

/** Push a string value to a named browser output field in real time. */
export type SetCommand = { set: Record<string, string> };

/** Persist arbitrary values into `state.vars` for the next call. */
export type VarsCommand = { vars: Record<string, unknown> };

/** Simulate a device disconnection on the app side. Closes the bridge WebSocket. */
export type DisconnectCommand = { disconnect: true };


/**
 * Make the next read of a characteristic fail with an error.
 * The error persists until cleared with `clearReadError`.
 */
export type ReadErrorCommand = { readError: { uuid: string } };

/** Clear a previously set read error for a characteristic. */
export type ClearReadErrorCommand = { clearReadError: { uuid: string } };

export type DeviceCommand =
  | CharCommand
  | DisconnectCommand
  | ReadErrorCommand
  | ClearReadErrorCommand
  | InCommand
  | OutCommand
  | SetCommand
  | VarsCommand
  | DevPatchCommand;

// ─── Function signature ───────────────────────────────────────────────────────

/**
 * The signature every device logic file must export as its default export.
 *
 * @example
 * ```js
 * /// <reference types="ble-faker/device" />
 *
 * /** @type {import('ble-faker/device').DeviceLogicFn} *\/
 * export default function (state, event) {
 *   if (event.kind === 'tick') {
 *     return [['2A37', utils.packUint16(72)]];
 *   }
 *   return [];
 * }
 * ```
 */
export type DeviceLogicFn = (
  state: DeviceState,
  event: DeviceEvent,
) => DeviceCommand[] | void;

// ─── Sandbox globals ──────────────────────────────────────────────────────────

/** Binary utility helpers available as a global in device logic files. */
export interface DeviceUtils {
  // ── Base64 ────────────────────────────────────────────────────────────────
  /** Encode a byte array to a base64 string. */
  toBase64(arr: Uint8Array): string;
  /** Decode a base64 string to a Uint8Array. */
  fromBase64(b64: string): Uint8Array;

  // ── Pack (number → base64, little-endian) ─────────────────────────────────
  /** 1-byte unsigned integer → base64. */
  packUint8(val: number): string;
  /** 1-byte signed integer → base64. */
  packInt8(val: number): string;
  /** 2-byte unsigned integer → base64 (little-endian). */
  packUint16(val: number): string;
  /** 2-byte signed integer → base64 (little-endian). */
  packInt16(val: number): string;
  /** 4-byte unsigned integer → base64 (little-endian). */
  packUint32(val: number): string;
  /** 4-byte IEEE 754 float → base64 (little-endian). */
  packFloat32(val: number): string;

  // ── Unpack (base64 → number, little-endian) ───────────────────────────────
  /** base64 → 1-byte unsigned integer. */
  unpackUint8(b64: string): number;
  /** base64 → 1-byte signed integer. */
  unpackInt8(b64: string): number;
  /** base64 → 2-byte unsigned integer (little-endian). */
  unpackUint16(b64: string): number;
  /** base64 → 2-byte signed integer (little-endian). */
  unpackInt16(b64: string): number;
  /** base64 → 4-byte unsigned integer (little-endian). */
  unpackUint32(b64: string): number;
  /** base64 → 4-byte IEEE 754 float (little-endian). */
  unpackFloat32(b64: string): number;
}

declare global {
  /**
   * Binary utility helpers injected into the device logic sandbox.
   * Available without any import.
   */
  // eslint-disable-next-line no-var
  var utils: DeviceUtils;
}
