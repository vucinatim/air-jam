import type {
  getAirJamDevProxyOptions,
  getAirJamHttpsServerOptions,
} from "./vite-https.mjs";

export type AirJamViteProfile = "default" | "three";

export interface CreateAirJamViteConfigOptions {
  env?: NodeJS.ProcessEnv;
  port?: number;
  profile?: AirJamViteProfile;
}

export declare const AIR_JAM_IFRAME_HEADERS: {
  "Content-Security-Policy": string;
};

type AirJamViteServerConfig = {
  host: true;
  allowedHosts: true;
  https: ReturnType<typeof getAirJamHttpsServerOptions>;
  port: number;
  strictPort: true;
  headers: typeof AIR_JAM_IFRAME_HEADERS;
  cors: true;
};

export declare function createAirJamViteConfig(
  options?: CreateAirJamViteConfigOptions,
): {
  build: {
    chunkSizeWarningLimit: number;
    rollupOptions?: {
      output: { manualChunks: (id: string) => string | undefined };
    };
  };
  server: AirJamViteServerConfig & {
    watch: { ignored: string[] };
    proxy: ReturnType<typeof getAirJamDevProxyOptions>;
  };
  preview: AirJamViteServerConfig;
};
