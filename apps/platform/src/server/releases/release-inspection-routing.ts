import type { BrowserContext } from "playwright-core";
import { RELEASE_INSPECTION_ACCESS_HEADER } from "./release-inspection-access";
import { createReleaseInspectionFetcher } from "./release-inspection-fetch";

/** Private inspection authority belongs to one generation, not the browser. */
export const installReleaseInspectionRouting = async (
  context: BrowserContext,
  {
    generationUrl,
    token,
    requestTimeoutMs,
  }: { generationUrl: string; token: string; requestTimeoutMs: number },
): Promise<void> => {
  const generation = new URL(generationUrl);
  const assetPrefix = `${generation.pathname.replace(/\/$/, "")}/`;
  const fetcher = createReleaseInspectionFetcher(requestTimeoutMs);
  context.on("close", fetcher.close);

  await context.route("**/*", async (route) => {
    try {
      const request = route.request();
      const url = new URL(request.url());
      const headers = Object.fromEntries(
        Object.entries(request.headers()).filter(
          ([name]) => name.toLowerCase() !== RELEASE_INSPECTION_ACCESS_HEADER,
        ),
      );
      const privateAsset =
        url.origin === generation.origin &&
        (url.pathname === generation.pathname ||
          url.pathname.startsWith(assetPrefix));

      if (!privateAsset) {
        await route.continue({ headers });
        return;
      }

      // Fetch exactly one response through pinned public IO. In particular,
      // CDP's context.request/route.fetch runs on the privileged caller.
      const response = await fetcher.fetch(
        url,
        {
          accept: headers.accept ?? "*/*",
          [RELEASE_INSPECTION_ACCESS_HEADER]: token,
        },
        request.method(),
      );
      await route.fulfill(response);
    } catch {
      // Do not expose Playwright errors containing private request headers.
      // A closed context may already have disposed this route.
      await route.abort("failed").catch(() => undefined);
    }
  });
};
