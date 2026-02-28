import fs from 'node:fs';
import path from 'node:path';
import type { DeviceState, UiControl } from './models/store.js';

export interface ApplyResult {
  state: DeviceState;
  wsMessages: Array<{ fieldName: string; value: string }>;
}

export function emptyDeviceState(): DeviceState {
  return {
    dev: {},
    vars: {},
    chars: {},
    ui: { ins: [], outs: [] },
  };
}

export function initDeviceState(categoryDir: string): DeviceState {
  const profilePath = path.join(categoryDir, 'gatt-profile.json');
  const raw = JSON.parse(fs.readFileSync(profilePath, 'utf-8')) as Record<string, unknown>;

  const { services, ...devFields } = raw;

  const chars: Record<string, string> = {};
  if (Array.isArray(services)) {
    for (const service of services as Array<{ characteristics?: Array<{ uuid: string }> }>) {
      for (const char of service.characteristics ?? []) {
        chars[char.uuid] = '';
      }
    }
  }

  return {
    dev: devFields as Record<string, unknown>,
    vars: {},
    chars,
    ui: { ins: [], outs: [] },
  };
}

export function applyCommands(result: unknown, current: DeviceState): ApplyResult {
  if (!Array.isArray(result)) {
    return { state: current, wsMessages: [] };
  }

  const state: DeviceState = {
    dev: { ...current.dev },
    vars: { ...current.vars },
    chars: { ...current.chars },
    ui: { ins: [...current.ui.ins], outs: [...current.ui.outs] },
  };
  const wsMessages: Array<{ fieldName: string; value: string }> = [];

  for (const item of result) {
    if (item === null || item === undefined) continue;

    // [uuid, base64] — characteristic update
    if (Array.isArray(item)) {
      if (item.length === 2 && typeof item[0] === 'string' && typeof item[1] === 'string') {
        state.chars[item[0]] = item[1];
      }
      continue;
    }

    if (typeof item !== 'object') continue;

    // { in: [{name, label}] } — define input controls
    if ('in' in item) {
      if (Array.isArray((item as { in: unknown }).in)) {
        state.ui.ins = (item as { in: UiControl[] }).in;
      }
      continue;
    }

    // { out: [{name, label}] } — define output controls
    if ('out' in item) {
      if (Array.isArray((item as { out: unknown }).out)) {
        state.ui.outs = (item as { out: UiControl[] }).out;
      }
      continue;
    }

    // { set: {fieldName: string} } — push to browser output fields
    if ('set' in item) {
      const setVal = (item as { set: unknown }).set;
      if (setVal !== null && typeof setVal === 'object') {
        for (const [fieldName, value] of Object.entries(setVal as Record<string, unknown>)) {
          if (typeof value === 'string') {
            wsMessages.push({ fieldName, value });
          }
        }
      }
      continue;
    }

    // { vars: {key: any} } — persist device-local values
    if ('vars' in item) {
      const varsVal = (item as { vars: unknown }).vars;
      if (varsVal !== null && typeof varsVal === 'object') {
        state.vars = { ...state.vars, ...(varsVal as Record<string, unknown>) };
      }
      continue;
    }

    // plain object fallback — patch state.dev
    state.dev = { ...state.dev, ...(item as Record<string, unknown>) };
  }

  return { state, wsMessages };
}
