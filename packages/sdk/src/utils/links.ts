import type { RoomCode } from "../protocol";
import { getLocalNetworkIp } from "./networkIp";

const DEFAULT_CONTROLLER_PATH = "/joypad";
const DEFAULT_SERVER_PORT = "4000";

const normalizeOrigin = (origin: string): string => {
  if (!origin.includes("://")) {
    return `http://${origin}`;
  }
  return origin;
};

const isLocalhost = (hostname: string): boolean => {
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
  );
};

/**
 * Gets the base URL for building controller URLs.
 * If on localhost, attempts to use the local network IP.
 */
const getBaseUrl = async (): Promise<string> => {
  if (typeof window === "undefined") {
    return `http://localhost:${DEFAULT_SERVER_PORT}`;
  }

  const currentUrl = new URL(window.location.href);

  // If not localhost, use the current origin
  if (!isLocalhost(currentUrl.hostname)) {
    return currentUrl.origin;
  }

  // If localhost, try to get the local network IP
  const localIp = await getLocalNetworkIp();
  if (localIp) {
    // Preserve the port from the current URL
    const port = currentUrl.port;
    return port ? `http://${localIp}:${port}` : `http://${localIp}`;
  }

  // Fallback to localhost if we can't determine the IP
  return currentUrl.origin;
};

export const resolveServerUrl = (explicit?: string): string => {
  if (explicit) {
    return normalizeOrigin(explicit);
  }

  if (typeof window !== "undefined") {
    const url = new URL(window.location.href);
    url.port = DEFAULT_SERVER_PORT;
    return url.origin;
  }

  return `http://localhost:${DEFAULT_SERVER_PORT}`;
};

export const buildControllerUrl = async (
  roomId: RoomCode,
  path: string = DEFAULT_CONTROLLER_PATH,
  hostOverride?: string
): Promise<string> => {
  const base = hostOverride ?? (await getBaseUrl());

  const url = new URL(path, normalizeOrigin(base));
  url.searchParams.set("room", roomId);
  return url.toString();
};
