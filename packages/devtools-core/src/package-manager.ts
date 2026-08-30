import type { AirJamPackageManager } from "./types.js";

type ExecutablePackageManager = Exclude<AirJamPackageManager, "unknown">;

export const resolvePackageManagerExecutable = (
  packageManager: ExecutablePackageManager,
  platform: NodeJS.Platform = process.platform,
): string =>
  platform === "win32" && packageManager !== "bun"
    ? `${packageManager}.cmd`
    : packageManager;
