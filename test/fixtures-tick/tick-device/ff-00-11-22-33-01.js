/** @type {import('ble-faker/device').DeviceLogicFn} */
export default function (state, event) {
  if (event.kind === "connect") {
    return [["2A00", Buffer.from("connected").toString("base64")]];
  }
  if (event.kind === "tick") {
    return [["2A00", Buffer.from("ticked").toString("base64")]];
  }
  return [];
}
