import { chromium } from "playwright-core";
import { z } from "zod";

const CLEANUP_TIMEOUT_MS = 5_000;
const sessionSchema = z.object({ sessionId: z.uuid() });
const acquisitionSchema = z.union([
  sessionSchema,
  z
    .object({ success: z.literal(true), result: sessionSchema })
    .transform((response) => response.result),
]);
const closureSchema = z.union([
  z.object({ status: z.enum(["closing", "closed"]) }),
  z.object({
    success: z.literal(true),
    result: z.object({ status: z.enum(["closing", "closed"]) }),
  }),
]);

/** Own one disposable provider session, including failed CDP connections. */
export const openCloudflareBrowserSession = async ({
  accountId,
  apiToken,
  timeoutMs,
}: {
  accountId: string;
  apiToken: string;
  timeoutMs: number;
}) => {
  if (!/^[a-f0-9]{32}$/.test(accountId) || !apiToken.trim()) {
    throw new Error("Cloudflare browser account and API token are required.");
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error("Cloudflare browser timeout must be a positive integer.");
  }
  const deadline = Date.now() + timeoutMs;
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/browser-run/devtools/browser`;
  const headers = { authorization: `Bearer ${apiToken}` };
  const acquisition = await fetch(`${endpoint}?keep_alive=60000`, {
    method: "POST",
    headers,
    redirect: "error",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!acquisition.ok) {
    throw new Error(
      `Cloudflare browser acquisition returned HTTP ${acquisition.status}.`,
    );
  }
  const parsed = acquisitionSchema.safeParse(await acquisition.json());
  if (!parsed.success) {
    throw new Error(
      "Cloudflare browser acquisition returned an invalid session.",
    );
  }
  // Never trust a provider-returned debugger URL with our bearer credential.
  const sessionEndpoint = `${endpoint}/${parsed.data.sessionId}`;
  const closeProviderSession = async () => {
    const response = await fetch(sessionEndpoint, {
      method: "DELETE",
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(CLEANUP_TIMEOUT_MS),
    });
    if (response.status === 404 || response.status === 410) return;
    if (!response.ok) {
      throw new Error(
        `Cloudflare browser closure returned HTTP ${response.status}.`,
      );
    }
    if (!closureSchema.safeParse(await response.json()).success) {
      throw new Error("Cloudflare browser closure was not acknowledged.");
    }
  };

  const browser = await (async () => {
    try {
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) throw new Error("Connection deadline exceeded.");
      return await chromium.connectOverCDP(
        sessionEndpoint.replace(/^https:/, "wss:"),
        { headers, timeout: remainingMs },
      );
    } catch {
      await closeProviderSession();
      // CDP errors can include the authenticated connection's headers.
      throw new Error("Cloudflare browser connection failed.");
    }
  })();

  let closing: Promise<void> | undefined;
  const close = () => {
    closing ??= (async () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const results = await Promise.allSettled([
          closeProviderSession(),
          Promise.race([
            browser.close().catch(() => {
              throw new Error("Cloudflare browser connection cleanup failed.");
            }),
            new Promise<never>((_, reject) => {
              timer = setTimeout(
                () =>
                  reject(new Error("Cloudflare browser cleanup timed out.")),
                CLEANUP_TIMEOUT_MS,
              );
            }),
          ]),
        ]);
        const failure = results.find((result) => result.status === "rejected");
        if (failure?.status === "rejected") throw failure.reason;
      } finally {
        clearTimeout(timer);
      }
    })();
    return closing;
  };

  return { browser, sessionId: parsed.data.sessionId, close };
};
