import fs from "node:fs";
import { DEFAULT_DEVICE_CODE } from "./default-device.js";

export function readDeviceCode(jsFilePath: string): string {
  try {
    const content = fs.readFileSync(jsFilePath, "utf-8").trim();
    return content.length === 0 ? DEFAULT_DEVICE_CODE : content;
  } catch {
    return DEFAULT_DEVICE_CODE;
  }
}
