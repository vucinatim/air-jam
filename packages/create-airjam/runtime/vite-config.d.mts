import type { UserConfig } from "vite";

export type AirJamViteProfile = "default" | "three";

export interface CreateAirJamViteConfigOptions {
  env?: NodeJS.ProcessEnv;
  port?: number;
  profile?: AirJamViteProfile;
}

export declare const AIR_JAM_IFRAME_HEADERS: {
  "Content-Security-Policy": string;
};

export declare function createAirJamViteConfig(
  options?: CreateAirJamViteConfigOptions,
): Pick<UserConfig, "build" | "server" | "preview">;
