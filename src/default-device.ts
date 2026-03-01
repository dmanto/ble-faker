import { GATT_LABELS } from './gatt-labels.js';

/**
 * Default device logic injected when a device JS file is empty.
 * Reads services/characteristics from state.dev (populated from gatt-profile.json),
 * maps read/notify characteristics to browser outputs and write characteristics to inputs,
 * and assigns a default ESP32-style name derived from the last 5 hex chars of the MAC.
 */
export const DEFAULT_DEVICE_CODE = `\
export default function(state, event) {
  var LABELS = ${JSON.stringify(GATT_LABELS)};

  if (event.kind === 'start' || event.kind === 'reload') {
    var mac = typeof state.dev.id === 'string' ? state.dev.id.replace(/-/g, '') : '';
    var shortId = mac.slice(-5).toUpperCase();
    var name = shortId ? ('ESP32_' + shortId) : 'ESP32';

    var outs = [];
    var ins = [];
    var services = Array.isArray(state.dev.services) ? state.dev.services : [];
    for (var i = 0; i < services.length; i++) {
      var svc = services[i];
      var chars = Array.isArray(svc.characteristics) ? svc.characteristics : [];
      for (var j = 0; j < chars.length; j++) {
        var c = chars[j];
        var uuid = String(c.uuid);
        var label = LABELS[uuid] !== undefined ? LABELS[uuid] : uuid;
        var props = c.properties || {};
        if (props.read || props.notify) outs.push({ name: uuid, label: label });
        if (props.write || props.writeWithoutResponse) ins.push({ name: uuid, label: label });
      }
    }

    var cmds = [{ name: name, rssi: -65 }];
    if (outs.length > 0) cmds.push({ out: outs });
    if (ins.length > 0) cmds.push({ in: ins });
    return cmds;
  }

  if (event.kind === 'input') {
    return [[event.id, Buffer.from(event.payload).toString('base64')]];
  }

  return [];
}
`;
