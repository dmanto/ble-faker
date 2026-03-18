/// <reference types="ble-faker/device" />

/**
 * Smart Bulb — ble-faker demo device
 *
 * Simulates a BLE-connected smart LED bulb with:
 *   - Power on/off, brightness, and colour temperature controls
 *   - Live power-draw readout (fluctuates slightly each tick)
 *   - App-side characteristic writes handled via notify
 *   - Overheating fault simulation (triggers a force-disconnect)
 *
 * UUIDs are fictional — for demonstration only.
 */

const CHAR_STATE = "12340001-0000-1000-8000-00805f9b34fb"; // on (1B) + brightness (1B)
const CHAR_COLOR = "12340002-0000-1000-8000-00805f9b34fb"; // colour temp uint16-LE

/** @type {import('ble-faker/device').DeviceLogicFn} */
export default function (state, event) {
  const { vars } = state;

  if (event.kind === "advertise") {
    return [{ name: "SmartBulb-Demo", rssi: -62 }];
  }

  if (event.kind === "start") {
    return [
      { vars: { on: true, brightness: 75, colorTemp: 4000, uptime: 0 } },
      {
        in: [
          { name: "power", label: "Power (on / off)" },
          { name: "brightness", label: "Brightness (0–100)" },
          { name: "colorTemp", label: "Colour temperature (2700–6500 K)" },
          { name: "fault", label: "Simulate overheating fault" },
        ],
      },
      {
        out: [
          { name: "state", label: "Bulb state" },
          { name: "power_draw", label: "Power draw" },
          { name: "uptime", label: "Uptime (seconds)" },
        ],
      },
    ];
  }

  if (event.kind === "connect") {
    console.log("App connected — pushing current bulb state");
    return [...pushState(vars), { set: { uptime: `${vars.uptime}s` } }];
  }

  if (event.kind === "disconnect") {
    console.log("App disconnected");
  }

  if (event.kind === "tick") {
    const uptime = vars.uptime + 1;
    const jitter = vars.on ? (Math.random() - 0.5) * 0.2 : 0;
    const newVars = { ...vars, uptime, _jitter: jitter };
    return [
      { vars: newVars },
      { set: { power_draw: formatPower(newVars) } },
      { set: { uptime: `${uptime}s` } },
    ];
  }

  if (event.kind === "input") {
    if (event.id === "power") {
      const on = event.payload.trim().toLowerCase() === "on";
      const newVars = { ...vars, on };
      return [{ vars: newVars }, ...pushState(newVars)];
    }
    if (event.id === "brightness") {
      const brightness = clamp(parseInt(event.payload, 10), 0, 100);
      const newVars = { ...vars, brightness };
      return [{ vars: newVars }, ...pushState(newVars)];
    }
    if (event.id === "colorTemp") {
      const colorTemp = clamp(parseInt(event.payload, 10), 2700, 6500);
      const newVars = { ...vars, colorTemp };
      const buf = Buffer.alloc(2);
      buf.writeUInt16LE(colorTemp);
      return [
        { vars: newVars },
        [CHAR_COLOR, buf.toString("base64")],
        { set: { state: describeState(newVars) } },
      ];
    }
    if (event.id === "fault") {
      console.log("Overheating fault triggered — disconnecting device");
      return { disconnect: true };
    }
  }

  if (event.kind === "notify" && event.uuid === CHAR_STATE) {
    const data = Buffer.from(event.payload, "base64");
    const on = data[0] === 1;
    const brightness = data[1] ?? vars.brightness;
    console.log(`App wrote bulb state: on=${on}, brightness=${brightness}`);
    const newVars = { ...vars, on, brightness };
    return [{ vars: newVars }, ...pushState(newVars)];
  }
}

function pushState(v) {
  const buf = Buffer.alloc(2);
  buf[0] = v.on ? 1 : 0;
  buf[1] = Math.round(v.brightness) & 0xff;
  return [
    [CHAR_STATE, buf.toString("base64")],
    { set: { state: describeState(v) } },
    { set: { power_draw: formatPower(v) } },
  ];
}

function describeState(v) {
  return v.on
    ? `ON  •  ${v.brightness}% brightness  •  ${v.colorTemp} K`
    : "OFF";
}

function formatPower(v) {
  if (!v.on) return "0.0 W  (standby)";
  const watts = (v.brightness / 100) * 9 + (v._jitter ?? 0);
  return `${watts.toFixed(1)} W`;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
