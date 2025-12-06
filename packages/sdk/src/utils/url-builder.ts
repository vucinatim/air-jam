import type { RoomCode } from "../protocol";
import { getLocalNetworkIp } from "./network-ip";
import { DEFAULT_SERVER_PORT, DEFAULT_CONTROLLER_PATH } from "../constants";

/**
 * Centralized URL builder service for Air Jam.
 * Handles IP detection, URL normalization, and construction of all URL types.
 */
class UrlBuilder {
  private cachedLocalIp: string | null = null;
  private ipDetectionPromise: Promise<string | null> | null = null;

  /**
   * Get the local network IP address with caching.
   * First call triggers detection, subsequent calls return cached value.
   */
  async getLocalIp(): Promise<string | null> {
    // Return cached value if available
    if (this.cachedLocalIp !== null) {
      return this.cachedLocalIp;
    }

    // If detection is already in progress, wait for it
    if (this.ipDetectionPromise !== null) {
      return this.ipDetectionPromise;
    }

    // Start IP detection
    this.ipDetectionPromise = getLocalNetworkIp().then((ip) => {
      this.cachedLocalIp = ip;
      this.ipDetectionPromise = null;
      return ip;
    });

    return this.ipDetectionPromise;
  }

  /**
   * Clear the cached IP address.
   * Useful for testing or when network changes are detected.
   */
  clearCache(): void {
    this.cachedLocalIp = null;
    this.ipDetectionPromise = null;
  }

  /**
   * Normalize a URL for mobile access.
   * Replaces localhost with the local network IP.
   */
  async normalizeForMobile(url: string): Promise<string> {
    if (typeof window === "undefined") return url;

    try {
      const urlObj = new URL(url);
      
      // If URL uses localhost, replace with local network IP
      if (urlObj.hostname === "localhost" || urlObj.hostname === "127.0.0.1") {
        const localIp = await this.getLocalIp();
        
        if (localIp) {
          urlObj.hostname = localIp;
          return urlObj.toString();
        }
        
        // Fallback to current hostname if IP detection fails
        urlObj.hostname = window.location.hostname;
        return urlObj.toString();
      }
      
      return url;
    } catch {
      return url;
    }
  }

  /**
   * Build a controller URL with room code.
   * Automatically uses local IP when running on localhost.
   */
  async buildControllerUrl(
    roomId: RoomCode,
    options?: {
      path?: string;
      host?: string;
    }
  ): Promise<string> {
    const path = options?.path || DEFAULT_CONTROLLER_PATH;
    
    // If explicit host is provided, use it
    if (options?.host) {
      const url = new URL(path, this.normalizeOrigin(options.host));
      url.searchParams.set("room", roomId);
      return url.toString();
    }

    // Determine base URL
    let base: string;
    if (typeof window === "undefined") {
      base = `http://localhost:${DEFAULT_SERVER_PORT}`;
    } else {
      const currentUrl = new URL(window.location.href);
      
      // If not localhost, use the current origin
      if (!this.isLocalhost(currentUrl.hostname)) {
        base = currentUrl.origin;
      } else {
        // If localhost, try to get the local network IP
        const localIp = await this.getLocalIp();
        if (localIp) {
          // Preserve the port from the current URL
          const port = currentUrl.port;
          base = port ? `http://${localIp}:${port}` : `http://${localIp}`;
        } else {
          // Fallback to localhost if we can't determine the IP
          base = currentUrl.origin;
        }
      }
    }

    const url = new URL(path, base);
    url.searchParams.set("room", roomId);
    return url.toString();
  }

  /**
   * Resolve the server URL.
   * Uses explicit URL if provided, otherwise infers from window location.
   */
  resolveServerUrl(explicit?: string): string {
    if (explicit) {
      return this.normalizeOrigin(explicit);
    }

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.port = String(DEFAULT_SERVER_PORT);
      return url.origin;
    }

    return `http://localhost:${DEFAULT_SERVER_PORT}`;
  }

  /**
   * Check if a hostname is localhost.
   */
  private isLocalhost(hostname: string): boolean {
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]"
    );
  }

  /**
   * Normalize an origin string to ensure it has a protocol.
   */
  private normalizeOrigin(origin: string): string {
    if (!origin.includes("://")) {
      return `http://${origin}`;
    }
    return origin;
  }
}

// Export singleton instance
export const urlBuilder = new UrlBuilder();

// Export class for testing/advanced usage
export { UrlBuilder };
