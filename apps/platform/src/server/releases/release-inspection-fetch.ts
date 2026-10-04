import {
  MAX_RELEASE_EXTRACTED_BYTES,
  MAX_RELEASE_FILE_BYTES,
  MAX_RELEASE_FILE_COUNT,
} from "@/lib/releases/release-policy";
import { isPublicReleaseOriginAddress } from "@air-jam/network-policy";
import { Resolver } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import { checkServerIdentity } from "node:tls";

/** One capture's private-asset IO, independent of where Playwright runs. */
export const createReleaseInspectionFetcher = (timeoutMs: number) => {
  const lifetime = new AbortController();
  let requestCount = 0;
  let receivedBytes = 0;
  let active = 0;
  const waiting: Array<() => void> = [];

  const close = () => {
    lifetime.abort();
    for (const resume of waiting.splice(0)) resume();
  };

  const fetchAsset = async (
    url: URL,
    headers: Record<string, string>,
    method: string,
  ) => {
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      !["GET", "HEAD"].includes(method)
    ) {
      throw new Error("Invalid release asset request.");
    }
    if (++requestCount > 2 * MAX_RELEASE_FILE_COUNT) close();
    const signal = AbortSignal.any([
      lifetime.signal,
      AbortSignal.timeout(timeoutMs),
    ]);
    signal.throwIfAborted();
    const acquired =
      active < 8
        ? (active++, true)
        : await new Promise<boolean>((resolve) => {
            const resume = () => {
              signal.removeEventListener("abort", resume);
              const index = waiting.indexOf(resume);
              if (index !== -1) waiting.splice(index, 1);
              if (!signal.aborted) active++;
              resolve(!signal.aborted);
            };
            waiting.push(resume);
            signal.addEventListener("abort", resume, { once: true });
          });
    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    const resolver = new Resolver();
    const cancelResolution = () => resolver.cancel();
    signal.addEventListener("abort", cancelResolution, { once: true });
    try {
      signal.throwIfAborted();
      const resolveFamily = async (family: 4 | 6) => {
        try {
          return family === 4
            ? await resolver.resolve4(hostname)
            : await resolver.resolve6(hostname);
        } catch (error) {
          if (
            ["ENODATA", "ENOTFOUND"].includes(
              (error as NodeJS.ErrnoException).code ?? "",
            )
          )
            return [];
          throw error;
        }
      };
      const addresses = isIP(hostname)
        ? [hostname]
        : (await Promise.all([resolveFamily(4), resolveFamily(6)])).flat();
      signal.throwIfAborted();
      const address = addresses[0];
      if (
        !address ||
        addresses.some((entry) => !isPublicReleaseOriginAddress(entry))
      )
        throw new Error("Release assets require exclusively public addresses.");

      return await new Promise<{
        status: number;
        headers: Record<string, string>;
        body: Buffer;
      }>((resolve, reject) => {
        const transport = url.protocol === "https:" ? https : http;
        const request = transport.request(
          {
            protocol: url.protocol,
            hostname: address,
            port: url.port || (url.protocol === "https:" ? 443 : 80),
            path: `${url.pathname}${url.search}`,
            method,
            headers: { ...headers, host: url.host },
            agent: false,
            signal,
            ...(url.protocol === "https:"
              ? {
                  ...(isIP(hostname) === 0 ? { servername: hostname } : {}),
                  rejectUnauthorized: true,
                  checkServerIdentity: (
                    _: string,
                    certificate: Parameters<typeof checkServerIdentity>[1],
                  ) => checkServerIdentity(hostname, certificate),
                }
              : {}),
          },
          (response) => {
            if (!response.statusCode) {
              request.destroy(
                new Error("Release asset response has no status."),
              );
              return;
            }
            const status = response.statusCode;
            const chunks: Buffer[] = [];
            let size = 0;
            response.on("error", reject);
            response.on("data", (chunk: Buffer) => {
              size += chunk.length;
              receivedBytes += chunk.length;
              if (
                receivedBytes > 2 * MAX_RELEASE_EXTRACTED_BYTES ||
                size > MAX_RELEASE_FILE_BYTES
              ) {
                close();
                request.destroy(
                  new Error("Release asset exceeds its size limit."),
                );
                return;
              }
              chunks.push(chunk);
            });
            response.on("end", () => {
              const stripped = new Set([
                "connection",
                "keep-alive",
                "proxy-authenticate",
                "proxy-authorization",
                "te",
                "trailer",
                "transfer-encoding",
                "upgrade",
                "set-cookie",
              ]);
              for (const name of String(
                response.headers.connection ?? "",
              ).split(","))
                stripped.add(name.trim().toLowerCase());
              resolve({
                status,
                headers: Object.fromEntries(
                  Object.entries(response.headers)
                    .filter(
                      ([name, value]) =>
                        value !== undefined &&
                        !stripped.has(name.toLowerCase()),
                    )
                    .map(([name, value]) => [
                      name,
                      Array.isArray(value) ? value.join(", ") : String(value),
                    ]),
                ),
                body: Buffer.concat(chunks),
              });
            });
          },
        );
        request.on("error", reject);
        request.end();
      });
    } finally {
      signal.removeEventListener("abort", cancelResolution);
      resolver.cancel();
      if (acquired) {
        active--;
        waiting.shift()?.();
      }
    }
  };

  return { fetch: fetchAsset, close };
};
