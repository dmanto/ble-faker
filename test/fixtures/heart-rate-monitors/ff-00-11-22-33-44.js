// @ts-check
/// <reference types="ble-faker/device" />

/** @type {import('ble-faker/device').DeviceLogicFn} */
export default function (state, event) {
  if (event.kind === "start" || event.kind === "reload") {
    return [["2A37", "AAEC"]];
  }
  if (event.kind === "notify") {
    return [["2A37", event.payload]];
  }
  if (event.kind === "input") {
    if (event.id === "disconnect") return [{ disconnect: true }];
    if (event.id === "readError")
      return [{ readError: { uuid: event.payload || "2A37" } }];
    if (event.id === "clearReadError")
      return [{ clearReadError: { uuid: event.payload || "2A37" } }];
  }
  return [];
}
