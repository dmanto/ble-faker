export interface UiControl {
  name: string;
  label: string;
}

export interface DeviceState {
  dev: Record<string, unknown>;
  vars: Record<string, unknown>;
  chars: Record<string, string>;
  ui: { ins: UiControl[]; outs: UiControl[] };
}

export interface DeviceEntry {
  id: string;
  categoryDir: string;
  state: DeviceState;
}

export function sanitizeDeviceId(raw: string): string {
  return raw.trim().toLowerCase().replace(/:/g, '-');
}

export class Store {
  private devices = new Map<string, DeviceEntry>();

  add(entry: DeviceEntry): void { this.devices.set(entry.id, entry); }
  get(id: string): DeviceEntry | undefined { return this.devices.get(id); }
  set(id: string, entry: DeviceEntry): void { this.devices.set(id, entry); }
  remove(id: string): boolean { return this.devices.delete(id); }
  has(id: string): boolean { return this.devices.has(id); }
  all(): DeviceEntry[] { return Array.from(this.devices.values()); }
}

declare module '@mojojs/core' {
  interface MojoModels {
    store: Store;
  }
}
